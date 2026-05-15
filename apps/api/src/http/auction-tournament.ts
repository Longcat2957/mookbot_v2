// 경매내전 토너먼트 lifecycle — CAPTAIN_PICK → POINT_ALLOC → BIDDING → PLACEMENT
// → BRACKET_SETUP → IN_GAME → COMPLETED.
//
// 각 단계 전이 endpoint + 입찰 / 유찰 / 배치 / 매치 생성 / 게임 결과 + 강제 취소.
// 게임 결과는 recordGameOnly (mmr 영향 0, game_stats 통합) 호출.

import { datadragon, db } from "@mookbot/core";
import type { FastifyInstance } from "fastify";
import { clearBidIntents, getBidIntents, setBidIntent } from "../domain/auctionBidIntents.js";
import { invalidate, requireEditor, requireSession, rewriteDD } from "./_helpers.js";

export async function registerAuctionTournamentRoutes(app: FastifyInstance): Promise<void> {
	// recruitment → tournament 전이 (운영자 [경매 시작])
	app.post<{ Body: { recruitmentId: number } }>("/api/auction-tournaments", async (req, reply) => {
		const sid = await requireEditor(req, reply);
		if (!sid) return;
		const recruitmentId = Number(req.body?.recruitmentId);
		if (!Number.isFinite(recruitmentId)) {
			return reply.code(400).send({ error: "recruitmentId required" });
		}
		const rec = await db.getAuctionRecruitment(recruitmentId);
		if (!rec) return reply.code(404).send({ error: "recruitment not found" });
		// OPEN (정원 도달 직후 직접 변환) 또는 CLOSED (봇 [▶ 경매 시작] 으로 마감된 상태) 둘 다 허용.
		// CONVERTED 면 이미 토너먼트 있음 — 별도 endpoint 로 진입.
		if (rec.status !== "OPEN" && rec.status !== "CLOSED") {
			return reply.code(409).send({ error: `status=${rec.status} — 변환 불가` });
		}
		if (rec.converted_tournament_id) {
			// 이미 변환됨 — 동일 id 반환 (멱등)
			return { tournamentId: rec.converted_tournament_id };
		}
		const participants = await db.listAuctionRecruitmentParticipants(recruitmentId);
		if (participants.length !== rec.target_count) {
			return reply.code(409).send({
				error: `정원 미충족 (${participants.length}/${rec.target_count})`,
			});
		}

		const season = await db.getCurrentSeason();
		if (!season) return reply.code(503).send({ error: "active season 없음" });

		// 토너먼트 id = recruitment.id (v0.3.4 패턴 일관)
		const tournament = await db.createAuctionTournament({
			id: recruitmentId,
			seasonId: season.id,
			format: rec.target_count,
			createdBy: sid,
		});
		await db.setAuctionRecruitmentStatus(recruitmentId, "CONVERTED", tournament.id);

		await db.recordAudit({
			operatorId: sid,
			action: "auction-tournament.created",
			targetType: "auction-tournament",
			targetId: String(tournament.id),
			payload: { format: rec.target_count, recruitmentId },
		});
		invalidate(`auction-recruitment:${recruitmentId}`, sid);
		invalidate("auction-dashboard", sid);
		return { tournamentId: tournament.id };
	});

	// 토너먼트 상세
	app.get<{ Params: { id: string } }>("/api/auction-tournaments/:id", async (req, reply) => {
		const sid = requireSession(req, reply);
		if (!sid) return;
		const id = Number(req.params.id);
		if (!Number.isFinite(id)) return reply.code(400).send({ error: "invalid id" });
		const t = await db.getAuctionTournament(id);
		if (!t) return reply.code(404).send({ error: "not found" });

		const rec = await db.getAuctionRecruitment(id);
		const recruitParts = rec ? await db.listAuctionRecruitmentParticipants(id) : [];
		const teams = await db.listAuctionTeams(id);
		const allMembers = await db.listAuctionTeamMembersByTournament(id);
		const matches = await db.listAuctionMatches(id);
		const bids = await db.listAuctionBids(id);

		const userIds = new Set<string>();
		for (const p of recruitParts) userIds.add(p.user_id);
		for (const m of allMembers) userIds.add(m.user_id);
		for (const t of teams) userIds.add(t.captain_user_id);
		if (t.current_bid_target_user_id) userIds.add(t.current_bid_target_user_id);
		const userIdList = [...userIds];
		const [users, mains] = await Promise.all([
			userIdList.length > 0 ? db.listUsers(userIdList) : Promise.resolve([]),
			userIdList.length > 0 ? db.listMainRiotAccounts(userIdList) : Promise.resolve([]),
		]);
		const nameById = new Map(users.map((u) => [u.discord_id, u.display_name]));
		const iconByUser = new Map(
			mains.flatMap((m) =>
				m.profile_icon_id == null
					? []
					: [[m.user_id, rewriteDD(datadragon.getProfileIconUrl(m.profile_icon_id))] as const],
			),
		);

		// team_id → members
		const membersByTeam = new Map<number, typeof allMembers>();
		for (const m of allMembers) {
			const members = membersByTeam.get(m.team_id) ?? [];
			members.push(m);
			membersByTeam.set(m.team_id, members);
		}
		// 모든 팀원 user_id 모음 (unsold 계산용)
		const placedUserIds = new Set(allMembers.map((m) => m.user_id));
		const unsold = recruitParts
			.filter((p) => !placedUserIds.has(p.user_id))
			.map((p) => ({
				userId: p.user_id,
				displayName: nameById.get(p.user_id) ?? p.user_id,
				profileIconUrl: iconByUser.get(p.user_id) ?? null,
			}));

		// v0.14: 현재 매물 + 입찰 의도 (transient) — BIDDING 화면 실시간 공유용.
		const currentBidTargetUserId = t.current_bid_target_user_id;
		const currentBidTarget = currentBidTargetUserId
			? {
					userId: currentBidTargetUserId,
					displayName: nameById.get(currentBidTargetUserId) ?? currentBidTargetUserId,
					profileIconUrl: iconByUser.get(currentBidTargetUserId) ?? null,
					intents: await getBidIntents(id),
				}
			: null;

		return {
			tournament: {
				id: t.id,
				format: t.format,
				status: t.status,
				championTeamId: t.champion_team_id,
				startedAt: t.started_at,
				endedAt: t.ended_at,
				currentBidTarget,
			},
			teams: teams.map((tt) => ({
				id: tt.id,
				teamIndex: tt.team_index,
				captainUserId: tt.captain_user_id,
				captainName: nameById.get(tt.captain_user_id) ?? tt.captain_user_id,
				captainProfileIconUrl: iconByUser.get(tt.captain_user_id) ?? null,
				teamName: tt.team_name,
				initialPoints: tt.initial_points,
				currentPoints: tt.current_points,
				members: (membersByTeam.get(tt.id) ?? []).map((m) => ({
					userId: m.user_id,
					displayName: nameById.get(m.user_id) ?? m.user_id,
					profileIconUrl: iconByUser.get(m.user_id) ?? null,
					acquiredVia: m.acquired_via,
					acquiredAtPoints: m.acquired_at_points,
				})),
			})),
			unsold,
			matches: matches.map((m) => ({
				matchId: m.id,
				round: m.round,
				bracketIndex: m.bracket_index,
				team1Id: m.team1_id,
				team2Id: m.team2_id,
				format: m.format,
				status: m.status,
				winningTeam: m.winning_team,
			})),
			bids: bids.map((b) => ({
				id: b.id,
				targetUserId: b.target_user_id,
				teamId: b.team_id,
				points: b.points,
				isFinal: b.is_final === 1,
				createdAt: b.created_at,
			})),
		};
	});

	// 팀장 4명/2명 set + 자동 POINT_ALLOC 진입
	app.put<{ Params: { id: string }; Body: { captainUserIds: string[] } }>(
		"/api/auction-tournaments/:id/captains",
		async (req, reply) => {
			const sid = await requireEditor(req, reply);
			if (!sid) return;
			const id = Number(req.params.id);
			if (!Number.isFinite(id)) return reply.code(400).send({ error: "invalid id" });
			const t = await db.getAuctionTournament(id);
			if (!t) return reply.code(404).send({ error: "not found" });
			if (t.status !== "CAPTAIN_PICK") {
				return reply.code(409).send({ error: `status=${t.status} — 팀장 set 불가` });
			}

			const expectedCount = t.format === 20 ? 4 : 2;
			const captains = req.body?.captainUserIds ?? [];
			if (captains.length !== expectedCount) {
				return reply
					.code(400)
					.send({ error: `팀장은 ${expectedCount}명 필요 (got ${captains.length})` });
			}
			if (new Set(captains).size !== captains.length) {
				return reply.code(400).send({ error: "중복된 팀장" });
			}

			// 기존 팀이 있으면 (revert 경로) clean — auction_teams CASCADE 로 members 도 삭제됨
			const existing = await db.listAuctionTeams(id);
			for (const e of existing) {
				await db.removeAuctionTeamMember(e.id, e.captain_user_id);
			}
			if (existing.length > 0) {
				// 통째로 삭제 (간단 — 부분 변경 케이스는 별도 endpoint)
				// 다만 이번 PUT 으로 captains 재설정 시 기존 팀을 모두 새로 만드는 게 안전
				// (실제 운영 흐름은 한 번 설정 후 거의 안 바뀜)
			}

			for (const [i, captainUserId] of captains.entries()) {
				await db.createAuctionTeam({
					tournamentId: id,
					teamIndex: i + 1,
					captainUserId,
				});
			}
			await db.setAuctionTournamentStatus(id, "POINT_ALLOC");
			await clearBidIntents(id); // defensive — revive 경로 잔재 cleanup

			await db.recordAudit({
				operatorId: sid,
				action: "auction-tournament.captains-set",
				targetType: "auction-tournament",
				targetId: String(id),
				payload: { captains },
			});
			invalidate(`auction-tournament:${id}`, sid);
			return { ok: true };
		},
	);

	// 팀별 initial_points 조정 (POINT_ALLOC 단계)
	app.put<{
		Params: { id: string };
		Body: { points: Array<{ teamId: number; initialPoints: number }> };
	}>("/api/auction-tournaments/:id/points", async (req, reply) => {
		const sid = await requireEditor(req, reply);
		if (!sid) return;
		const id = Number(req.params.id);
		if (!Number.isFinite(id)) return reply.code(400).send({ error: "invalid id" });
		const t = await db.getAuctionTournament(id);
		if (!t) return reply.code(404).send({ error: "not found" });
		if (t.status !== "POINT_ALLOC" && t.status !== "BIDDING") {
			return reply.code(409).send({ error: `status=${t.status} — 포인트 조정 불가` });
		}
		for (const p of req.body?.points ?? []) {
			if (p.initialPoints < 0) {
				return reply.code(400).send({ error: "initial_points >= 0" });
			}
			await db.setAuctionTeamPoints(p.teamId, p.initialPoints);
		}
		await db.recordAudit({
			operatorId: sid,
			action: "auction-tournament.points-set",
			targetType: "auction-tournament",
			targetId: String(id),
			payload: { points: req.body.points },
		});
		invalidate(`auction-tournament:${id}`, sid);
		return { ok: true };
	});

	// POINT_ALLOC → BIDDING 진입
	app.post<{ Params: { id: string } }>(
		"/api/auction-tournaments/:id/start-bidding",
		async (req, reply) => {
			const sid = await requireEditor(req, reply);
			if (!sid) return;
			const id = Number(req.params.id);
			const t = await db.getAuctionTournament(id);
			if (!t) return reply.code(404).send({ error: "not found" });
			if (t.status !== "POINT_ALLOC") {
				return reply.code(409).send({ error: `status=${t.status}` });
			}
			await db.setAuctionTournamentStatus(id, "BIDDING");
			await clearBidIntents(id); // BIDDING 진입 — 이전 잔재 cleanup
			invalidate(`auction-tournament:${id}`, sid);
			return { ok: true };
		},
	);

	// 🎲 다음 인원 추출 — 미배치 비-팀장 중 random 1명. 서버가 결정 (조작 방지).
	app.post<{ Params: { id: string } }>("/api/auction-tournaments/:id/draw", async (req, reply) => {
		const sid = await requireEditor(req, reply);
		if (!sid) return;
		const id = Number(req.params.id);
		const t = await db.getAuctionTournament(id);
		if (!t) return reply.code(404).send({ error: "not found" });
		if (t.status !== "BIDDING") {
			return reply.code(409).send({ error: `status=${t.status}` });
		}
		const recruitParts = await db.listAuctionRecruitmentParticipants(id);
		const allMembers = await db.listAuctionTeamMembersByTournament(id);
		const placed = new Set(allMembers.map((m) => m.user_id));
		const remaining = recruitParts.filter((p) => !placed.has(p.user_id));
		if (remaining.length === 0) {
			// 정상 종료 — 모두 배치 완료. 현재 매물 잔재가 있으면 cleanup + broadcast.
			if (t.current_bid_target_user_id) {
				await db.setAuctionCurrentBidTarget(id, null);
				await clearBidIntents(id);
				invalidate(`auction-tournament:${id}`, sid);
			}
			return { userId: null, displayName: null, remainingCount: 0, done: true };
		}
		const pick = remaining[Math.floor(Math.random() * remaining.length)];
		if (!pick) return { userId: null, displayName: null, remainingCount: 0, done: true };
		const users = await db.listUsers([pick.user_id]);
		// v0.14: DB 에 현재 매물 set + 이전 매물의 입찰 의도 잔재 clear → 모든 화면 sync.
		await db.setAuctionCurrentBidTarget(id, pick.user_id);
		await clearBidIntents(id);
		invalidate(`auction-tournament:${id}`, sid);
		return {
			userId: pick.user_id,
			displayName: users[0]?.display_name ?? pick.user_id,
			remainingCount: remaining.length,
			done: false,
		};
	});

	// 낙찰 확정 — target user 를 team 에 배치, captain 포인트 차감, audit bid 기록.
	app.post<{
		Params: { id: string };
		Body: { targetUserId: string; teamId: number; points: number };
	}>("/api/auction-tournaments/:id/finalize-bid", async (req, reply) => {
		const sid = await requireEditor(req, reply);
		if (!sid) return;
		const id = Number(req.params.id);
		const t = await db.getAuctionTournament(id);
		if (!t) return reply.code(404).send({ error: "not found" });
		if (t.status !== "BIDDING") return reply.code(409).send({ error: `status=${t.status}` });

		const { targetUserId, teamId, points } = req.body ?? {};
		if (!targetUserId || !teamId || points == null || points < 0) {
			return reply.code(400).send({ error: "targetUserId / teamId / points required" });
		}
		const team = await db.getAuctionTeam(teamId);
		if (!team || team.tournament_id !== id) {
			return reply.code(400).send({ error: "team not in this tournament" });
		}
		if (team.current_points < points) {
			return reply.code(409).send({ error: "포인트 부족" });
		}
		const existing = await db.getAuctionTeamForUserInTournament(id, targetUserId);
		if (existing) {
			return reply.code(409).send({ error: "이미 배치된 사용자" });
		}
		// 팀 사이즈 가드 — 5인/팀
		const members = await db.listAuctionTeamMembers(teamId);
		if (members.length >= 5) {
			return reply.code(409).send({ error: "팀 정원 도달 (5명)" });
		}

		await db.addAuctionTeamMember({
			teamId,
			userId: targetUserId,
			acquiredVia: "BID",
			acquiredAtPoints: points,
		});
		await db.adjustAuctionTeamCurrentPoints(teamId, -points);
		await db.recordAuctionBid({
			tournamentId: id,
			targetUserId,
			teamId,
			points,
			isFinal: true,
		});

		await db.recordAudit({
			operatorId: sid,
			action: "auction-tournament.bid-finalized",
			targetType: "auction-tournament",
			targetId: String(id),
			payload: { targetUserId, teamId, points },
		});
		// v0.14: 매물 확정 — 현재 매물 + 입찰 의도 clear.
		await db.setAuctionCurrentBidTarget(id, null);
		await clearBidIntents(id);
		invalidate(`auction-tournament:${id}`, sid);
		return { ok: true };
	});

	// 수동 배치 (유찰자 / 포인트 소진 후) — 포인트 무관
	app.post<{
		Params: { id: string };
		Body: { targetUserId: string; teamId: number };
	}>("/api/auction-tournaments/:id/manual-assign", async (req, reply) => {
		const sid = await requireEditor(req, reply);
		if (!sid) return;
		const id = Number(req.params.id);
		const t = await db.getAuctionTournament(id);
		if (!t) return reply.code(404).send({ error: "not found" });
		if (t.status !== "BIDDING") return reply.code(409).send({ error: `status=${t.status}` });

		const { targetUserId, teamId } = req.body ?? {};
		if (!targetUserId || !teamId) {
			return reply.code(400).send({ error: "targetUserId / teamId required" });
		}
		const team = await db.getAuctionTeam(teamId);
		if (!team || team.tournament_id !== id) {
			return reply.code(400).send({ error: "team not in this tournament" });
		}
		const existing = await db.getAuctionTeamForUserInTournament(id, targetUserId);
		if (existing) return reply.code(409).send({ error: "이미 배치된 사용자" });
		const members = await db.listAuctionTeamMembers(teamId);
		if (members.length >= 5) {
			return reply.code(409).send({ error: "팀 정원 도달 (5명)" });
		}
		await db.addAuctionTeamMember({ teamId, userId: targetUserId, acquiredVia: "MANUAL" });
		await db.recordAudit({
			operatorId: sid,
			action: "auction-tournament.manual-assigned",
			targetType: "auction-tournament",
			targetId: String(id),
			payload: { targetUserId, teamId },
		});
		// v0.14: 수동 배치도 현재 매물 + 입찰 의도 clear (manual-assign 은 보통 현재 매물 + 다른
		// teamId 조합이지만, 안전을 위해 매물 ID 일치 여부 무관하게 clear).
		await db.setAuctionCurrentBidTarget(id, null);
		await clearBidIntents(id);
		invalidate(`auction-tournament:${id}`, sid);
		return { ok: true };
	});

	// v0.14: 현재 매물 취소 — 운영자가 진행 중인 매물을 그냥 닫음 (배치 / 유찰 결정 안 함).
	// 다음 /draw 가 가능하도록 슬롯만 비우는 명령. 입찰 의도도 같이 clear.
	app.post<{ Params: { id: string } }>(
		"/api/auction-tournaments/:id/cancel-draw",
		async (req, reply) => {
			const sid = await requireEditor(req, reply);
			if (!sid) return;
			const id = Number(req.params.id);
			const t = await db.getAuctionTournament(id);
			if (!t) return reply.code(404).send({ error: "not found" });
			if (t.status !== "BIDDING") return reply.code(409).send({ error: `status=${t.status}` });
			if (!t.current_bid_target_user_id) return { ok: true }; // 이미 비어 있음 (멱등)
			await db.setAuctionCurrentBidTarget(id, null);
			await clearBidIntents(id);
			invalidate(`auction-tournament:${id}`, sid);
			return { ok: true };
		},
	);

	// v0.14: 입찰 의도 (transient) — 운영자 입력 중 가격을 다른 화면에 실시간 공유.
	// body { teamId, points: number | null }. points=null = clear (취소).
	// 영속화 X — 서버 in-memory only. finalize/cancel/status 전환 시 자동 clear.
	app.post<{
		Params: { id: string };
		Body: { teamId: number; points: number | null };
	}>("/api/auction-tournaments/:id/bid-intent", async (req, reply) => {
		const sid = await requireEditor(req, reply);
		if (!sid) return;
		const id = Number(req.params.id);
		const t = await db.getAuctionTournament(id);
		if (!t) return reply.code(404).send({ error: "not found" });
		if (t.status !== "BIDDING") return reply.code(409).send({ error: `status=${t.status}` });
		if (!t.current_bid_target_user_id) {
			return reply.code(409).send({ error: "현재 매물 없음 — 먼저 /draw" });
		}
		const teamId = Number(req.body?.teamId);
		if (!Number.isFinite(teamId) || teamId <= 0) {
			return reply.code(400).send({ error: "teamId required" });
		}
		const team = await db.getAuctionTeam(teamId);
		if (!team || team.tournament_id !== id) {
			return reply.code(400).send({ error: "team not in this tournament" });
		}
		const points = req.body?.points;
		if (points !== null && (typeof points !== "number" || !Number.isFinite(points) || points < 0)) {
			return reply.code(400).send({ error: "points: number >= 0 or null" });
		}
		await setBidIntent(id, teamId, points);
		invalidate(`auction-tournament:${id}`, sid);
		return { ok: true };
	});

	// 낙찰 취소 (매물 단위 되돌리기 — Q15) — target 의 모든 입찰 + 팀원 + 포인트 복원
	app.post<{ Params: { id: string }; Body: { targetUserId: string } }>(
		"/api/auction-tournaments/:id/revert-bid",
		async (req, reply) => {
			const sid = await requireEditor(req, reply);
			if (!sid) return;
			const id = Number(req.params.id);
			const t = await db.getAuctionTournament(id);
			if (!t) return reply.code(404).send({ error: "not found" });
			if (t.status !== "BIDDING") return reply.code(409).send({ error: `status=${t.status}` });

			const targetUserId = req.body?.targetUserId;
			if (!targetUserId) return reply.code(400).send({ error: "targetUserId required" });

			const team = await db.getAuctionTeamForUserInTournament(id, targetUserId);
			if (!team) return reply.code(404).send({ error: "사용자 배치 안 됨" });
			const members = await db.listAuctionTeamMembers(team.id);
			const targetMember = members.find((m) => m.user_id === targetUserId);
			if (!targetMember) return reply.code(404).send({ error: "팀원 row 없음" });

			// 포인트 복원 (BID 인 경우만)
			if (targetMember.acquired_via === "BID" && targetMember.acquired_at_points != null) {
				await db.adjustAuctionTeamCurrentPoints(team.id, targetMember.acquired_at_points);
			}
			await db.removeAuctionTeamMember(team.id, targetUserId);
			await db.deleteAuctionBidsForTarget(id, targetUserId);

			await db.recordAudit({
				operatorId: sid,
				action: "auction-tournament.bid-reverted",
				targetType: "auction-tournament",
				targetId: String(id),
				payload: { targetUserId, teamId: team.id },
			});
			invalidate(`auction-tournament:${id}`, sid);
			return { ok: true };
		},
	);

	// 단계 되돌리기 — 운영자가 잘못 진행한 단계를 이전으로 복원.
	// target 옵션:
	//   - CAPTAIN_PICK: 모든 팀 / 팀원 / 입찰 정리 → CAPTAIN_PICK 단계로
	//   - POINT_ALLOC: 입찰 + 팀원 (팀장 제외) 정리 + current_points = initial_points → POINT_ALLOC
	//   - BIDDING: 그대로 BIDDING (PLACEMENT 같은 transient 상태에서 복귀)
	app.post<{
		Params: { id: string };
		Body: { target: "CAPTAIN_PICK" | "POINT_ALLOC" | "BIDDING" };
	}>("/api/auction-tournaments/:id/revert-stage", async (req, reply) => {
		const sid = await requireEditor(req, reply);
		if (!sid) return;
		const id = Number(req.params.id);
		const t = await db.getAuctionTournament(id);
		if (!t) return reply.code(404).send({ error: "not found" });
		// COMPLETED / CANCELLED / IN_GAME 이상은 매치 결과 영향 — 강제 취소 사용 권장.
		if (t.status === "COMPLETED" || t.status === "CANCELLED") {
			return reply.code(409).send({ error: `status=${t.status} — 단계 되돌리기 불가` });
		}
		if (t.status === "IN_GAME" || t.status === "BRACKET_SETUP") {
			return reply.code(409).send({
				error: `status=${t.status} — 매치/브래킷 진행 중. 강제 취소 후 다시 시작 권장.`,
			});
		}
		const target = req.body?.target;
		if (!target) return reply.code(400).send({ error: "target required" });

		const teams = await db.listAuctionTeams(id);

		if (target === "CAPTAIN_PICK") {
			// 모든 입찰 / 팀원 / 팀 정리. CASCADE 로 자동.
			for (const team of teams) {
				await import("@mookbot/core").then((m) =>
					m.cloudflare.execute(`DELETE FROM auction_teams WHERE id = ?`, [team.id]),
				);
			}
			await db.setAuctionTournamentStatus(id, "CAPTAIN_PICK");
		} else if (target === "POINT_ALLOC") {
			// 입찰 + 팀원 (팀장 외) 정리, 포인트 reset
			for (const team of teams) {
				await import("@mookbot/core").then(async (m) => {
					await m.cloudflare.execute(
						`DELETE FROM auction_team_members WHERE team_id = ? AND user_id != ?`,
						[team.id, team.captain_user_id],
					);
					await m.cloudflare.execute(
						`UPDATE auction_teams SET current_points = initial_points WHERE id = ?`,
						[team.id],
					);
				});
			}
			await import("@mookbot/core").then((m) =>
				m.cloudflare.execute(`DELETE FROM auction_bids WHERE tournament_id = ?`, [id]),
			);
			await db.setAuctionTournamentStatus(id, "POINT_ALLOC");
		} else if (target === "BIDDING") {
			await db.setAuctionTournamentStatus(id, "BIDDING");
		}

		// v0.14: revert-stage 가 어디로 가든 in-memory intents 잔재 cleanup.
		await clearBidIntents(id);
		await db.recordAudit({
			operatorId: sid,
			action: "auction-tournament.stage-reverted",
			targetType: "auction-tournament",
			targetId: String(id),
			payload: { from: t.status, to: target },
		});
		invalidate(`auction-tournament:${id}`, sid);
		return { ok: true };
	});

	// BIDDING → PLACEMENT (모두 배치 확인) → BRACKET_SETUP
	app.post<{ Params: { id: string } }>(
		"/api/auction-tournaments/:id/start-bracket",
		async (req, reply) => {
			const sid = await requireEditor(req, reply);
			if (!sid) return;
			const id = Number(req.params.id);
			const t = await db.getAuctionTournament(id);
			if (!t) return reply.code(404).send({ error: "not found" });
			if (t.status !== "BIDDING") return reply.code(409).send({ error: `status=${t.status}` });

			const recruitParts = await db.listAuctionRecruitmentParticipants(id);
			const allMembers = await db.listAuctionTeamMembersByTournament(id);
			if (allMembers.length !== recruitParts.length) {
				return reply
					.code(409)
					.send({ error: `배치 미완료 (${allMembers.length}/${recruitParts.length})` });
			}
			await db.setAuctionTournamentStatus(id, "BRACKET_SETUP");
			await clearBidIntents(id);
			invalidate(`auction-tournament:${id}`, sid);
			return { ok: true };
		},
	);

	// 토너먼트 강제 취소
	app.post<{ Params: { id: string } }>("/api/auction-tournaments/:id/cancel", async (req, reply) => {
		const sid = await requireEditor(req, reply);
		if (!sid) return;
		const id = Number(req.params.id);
		const t = await db.getAuctionTournament(id);
		if (!t) return reply.code(404).send({ error: "not found" });
		if (t.status === "COMPLETED" || t.status === "CANCELLED") {
			return reply.code(409).send({ error: `status=${t.status}` });
		}
		await db.cancelAuctionTournament(id);
		await clearBidIntents(id);
		await db.recordAudit({
			operatorId: sid,
			action: "auction-tournament.cancelled",
			targetType: "auction-tournament",
			targetId: String(id),
		});
		invalidate(`auction-tournament:${id}`, sid);
		invalidate("auction-dashboard", sid);
		return { ok: true };
	});
}
