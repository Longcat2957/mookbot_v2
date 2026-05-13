// 시리즈 생성 / 목록 / 상세 / 종료된 시리즈 / pickban draft / revert.
// 게임 결과 입력 (POST games / DELETE last) 은 ./games.ts 분리.

import { cloudflare, datadragon, db } from "@mookbot/core";
import type { FastifyInstance } from "fastify";
import { notifyBotRecruitRefresh } from "../bot/notify.js";
import { HttpError } from "./_errors.js";
import { invalidate, requireEditor, requireSession, rewriteDD } from "./_helpers.js";
import { emptyHistory, fetchPlayHistoryFor } from "./_history.js";

const { getRecruitment } = db;

export async function registerSeriesRoutes(app: FastifyInstance): Promise<void> {
	// 시리즈 생성 — 엔트리 수정에서 [엔트리 제출] 시 호출.
	// 모집의 status 를 CONVERTED 로 전이 + series row + series_participants insert.
	app.post<{
		Body: {
			recruitmentId: number;
			assignments: { userId: string; team: "TEAM_1" | "TEAM_2"; role: string }[];
			// 엔트리 제출 시 코인토스 결과. 입력되면 Game 1 의 1팀 사이드를 미리 결정 —
			// 1팀=BLUE 가 되도록 클라이언트에서 swap 후 전송하므로 서버 단에선 단순 저장.
			team1Side?: "BLUE" | "RED";
		};
	}>("/api/series", async (req, reply) => {
		const sid = await requireEditor(req, reply);
		if (!sid) return;

		const { recruitmentId, assignments, team1Side } = req.body ?? {};
		if (!recruitmentId || !Array.isArray(assignments)) {
			return reply.code(400).send({ error: "recruitmentId / assignments required" });
		}
		if (team1Side !== undefined && team1Side !== "BLUE" && team1Side !== "RED") {
			return reply.code(400).send({ error: "team1Side must be BLUE or RED" });
		}

		const rec = await getRecruitment(recruitmentId);
		if (!rec) return reply.code(404).send({ error: "recruitment not found" });
		if (rec.status === "CONVERTED") {
			return reply.code(409).send({ error: "이미 시리즈로 변환된 모집입니다." });
		}
		if (rec.status === "CANCELLED") {
			return reply.code(409).send({ error: "취소된 모집입니다." });
		}

		let series: Awaited<ReturnType<typeof db.createSeries>>;
		try {
			series = await db.createSeries({
				// 시리즈 ID = 모집 ID — 사용자 혼동 방지 (모집 #N → 시리즈 #N)
				id: recruitmentId,
				seasonId: rec.season_id,
				createdBy: sid,
				participants: assignments.map((a) => ({
					userId: a.userId,
					team: a.team,
					role: a.role as "TOP" | "JUNGLE" | "MID" | "BOTTOM" | "SUPPORT",
				})),
			});
		} catch (err) {
			req.log.error({ err, recruitmentId }, "createSeries failed");
			throw new HttpError(400, err instanceof Error ? err.message : String(err));
		}
		// 코인토스 결과 받으면 Game 1 team1Side 미리 저장 — PickBan 진입 시 사이드 결정 카드 skip.
		if (team1Side) {
			const teamSize = Math.floor(assignments.length / 2);
			const emptyArr = () => Array<number | null>(teamSize).fill(null);
			const initialDraft = {
				games: [1, 2, 3].map((n) => ({
					gameNumber: n,
					team1Side: n === 1 ? team1Side : null,
					bans: { TEAM_1: emptyArr(), TEAM_2: emptyArr() },
					picks: { TEAM_1: emptyArr(), TEAM_2: emptyArr() },
				})),
				currentGame: 1,
			};
			await db.setKv(`pickban:${series.id}`, JSON.stringify(initialDraft), sid);
		}
		await db.setRecruitmentStatus(recruitmentId, "CONVERTED", series.id);
		await db.recordAudit({
			operatorId: sid,
			action: "series.created",
			targetType: "series",
			targetId: String(series.id),
			payload: {
				recruitmentId,
				seasonId: rec.season_id,
				participantCount: assignments.length,
				team1Side: team1Side ?? null,
			},
		});
		invalidate("dashboard");
		invalidate(`recruitment:${recruitmentId}`);
		invalidate(`series:${series.id}`);
		// 봇에 Discord 모집 메시지 갱신 요청 — best-effort, 실패해도 API 응답은 정상.
		void notifyBotRecruitRefresh(recruitmentId).catch((err) => {
			req.log.warn({ err, recruitmentId }, "notifyBotRecruitRefresh failed");
		});
		return { seriesId: series.id };
	});

	// 종료된 시리즈 목록 (status=COMPLETED) — 지난 내전 기록.
	// limit + offset 페이지네이션. total 포함 응답.
	app.get<{ Querystring: { limit?: string; offset?: string } }>(
		"/api/series/completed",
		async (req, reply) => {
			const sid = requireSession(req, reply);
			if (!sid) return;

			const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)));
			const offset = Math.max(0, Number(req.query.offset ?? 0));

			// v0.11.0: series 는 RANKED 전용 — type 필터 불필요. 경매내전은 자체 흐름.
			// soft-deleted (deleted_at != NULL) 행은 제외 — force-delete / season-reset 흔적 비노출.
			const totalRow = await cloudflare.queryOne<{ count: number }>(
				`SELECT COUNT(*) AS count FROM series WHERE status = 'COMPLETED' AND deleted_at IS NULL`,
			);
			const total = totalRow?.count ?? 0;

			const rows = await cloudflare.query<{
				id: number;
				season_id: number;
				status: string;
				winning_team: string | null;
				started_at: number;
				ended_at: number | null;
			}>(
				`SELECT id, season_id, status, winning_team, started_at, ended_at
					 FROM series
					 WHERE status = 'COMPLETED' AND deleted_at IS NULL
					 ORDER BY ended_at DESC
					 LIMIT ? OFFSET ?`,
				[limit, offset],
			);
			if (rows.length === 0) return { series: [], total };

			const seriesIds = rows.map((s) => s.id);
			const partsAll = await Promise.all(seriesIds.map((id) => db.getSeriesParticipants(id)));
			const allUserIds = [...new Set(partsAll.flat().map((p) => p.user_id))];
			const [users, mains] = await Promise.all([
				db.listUsers(allUserIds),
				db.listMainRiotAccounts(allUserIds),
			]);
			const nameById = new Map(users.map((u) => [u.discord_id, u.display_name]));
			const iconById = new Map(
				mains
					.filter((m) => m.profile_icon_id != null)
					.map((m) => [m.user_id, rewriteDD(datadragon.getProfileIconUrl(m.profile_icon_id as number))]),
			);

			const winsAll = await Promise.all(rows.map((s) => db.countSeriesWins(s.id)));

			return {
				series: rows.map((s, i) => ({
					id: s.id,
					seasonId: s.season_id,
					status: s.status,
					winningTeam: s.winning_team,
					startedAt: s.started_at,
					endedAt: s.ended_at,
					wins: winsAll[i] ?? { team1: 0, team2: 0 },
					participants: (partsAll[i] ?? []).map((p) => ({
						userId: p.user_id,
						displayName: nameById.get(p.user_id) ?? p.user_id,
						team: p.team,
						role: p.role,
						profileIconUrl: iconById.get(p.user_id) ?? null,
					})),
				})),
				total,
			};
		},
	);

	// 진행 중 시리즈 목록 (status=IN_PROGRESS) — Activity 재진입 시 이어서 작업.
	// 카드 미리보기용으로 라인업도 같이 반환.
	app.get("/api/series", async (req, reply) => {
		const sid = requireSession(req, reply);
		if (!sid) return;

		const rows = await db.listAllOpenSeries();
		if (rows.length === 0) return { series: [] };

		// 모든 참가자 한 번에 — 시리즈별로 그룹핑
		const seriesIds = rows.map((s) => s.id);
		const partsAll = await Promise.all(seriesIds.map((id) => db.getSeriesParticipants(id)));
		const allUserIds = [...new Set(partsAll.flat().map((p) => p.user_id))];
		const [users, mains] = await Promise.all([
			db.listUsers(allUserIds),
			db.listMainRiotAccounts(allUserIds),
		]);
		const nameById = new Map(users.map((u) => [u.discord_id, u.display_name]));
		const iconById = new Map(
			mains
				.filter((m) => m.profile_icon_id != null)
				.map((m) => [m.user_id, rewriteDD(datadragon.getProfileIconUrl(m.profile_icon_id as number))]),
		);

		return {
			series: rows.map((s, i) => ({
				id: s.id,
				seasonId: s.season_id,
				status: s.status,
				startedAt: s.started_at,
				participants: (partsAll[i] ?? []).map((p) => ({
					userId: p.user_id,
					displayName: nameById.get(p.user_id) ?? p.user_id,
					team: p.team,
					role: p.role,
					profileIconUrl: iconById.get(p.user_id) ?? null,
				})),
			})),
		};
	});

	// 단일 시리즈 상세 — 참가자 + 픽/밴 draft + 완료 게임
	app.get<{ Params: { id: string } }>("/api/series/:id", async (req, reply) => {
		const sid = requireSession(req, reply);
		if (!sid) return;

		const id = Number(req.params.id);
		if (!Number.isFinite(id)) return reply.code(400).send({ error: "invalid id" });

		const s = await db.getSeries(id);
		if (!s) return reply.code(404).send({ error: "not found" });

		const parts = await db.getSeriesParticipants(id);
		const partUserIds = parts.map((p) => p.user_id);
		const [users, mains] = await Promise.all([
			db.listUsers(partUserIds),
			db.listMainRiotAccounts(partUserIds),
		]);
		const nameById = new Map(users.map((u) => [u.discord_id, u.display_name]));
		const iconById = new Map(
			mains
				.filter((m) => m.profile_icon_id != null)
				.map((m) => [m.user_id, rewriteDD(datadragon.getProfileIconUrl(m.profile_icon_id as number))]),
		);
		// PickBan 의 챔프 그리드 "MY MAINS" 표시용 — 참가자 전적/주력 챔프
		const stats = await fetchPlayHistoryFor(parts.map((p) => p.user_id));

		// 라인별 MMR — BalancePreview HTML 렌더 / 라인 매치업 표시용.
		// 누락된 (userId, role) 은 1500 default. balance-svg.ts 와 동일 패턴.
		const mmrPairs = parts.map((p) => ({
			userId: p.user_id,
			role: p.role as "TOP" | "JUNGLE" | "MID" | "BOTTOM" | "SUPPORT",
		}));
		const mmrRows = await db.getLaneMmrs(mmrPairs, s.season_id);
		const mmrByKey = new Map<string, number>();
		for (const r of mmrRows) mmrByKey.set(`${r.user_id}|${r.role}`, r.mmr);
		const DEFAULT_MMR = 1500;

		const games = await db.listGamesInSeries(id);
		// 게임별 picks/bans 조회 — picks 는 하드피어리스 검증, bans 는 SeriesResult 화면용
		const [gamePicks, gameBans] = await Promise.all([
			Promise.all(games.map(async (g) => ({ gameId: g.id, picks: await db.getGamePicks(g.id) }))),
			Promise.all(games.map(async (g) => ({ gameId: g.id, bans: await db.getGameBans(g.id) }))),
		]);
		const picksByGame = new Map(gamePicks.map((x) => [x.gameId, x.picks]));
		const bansByGame = new Map(gameBans.map((x) => [x.gameId, x.bans]));

		const draftRaw = await db.getKv(`pickban:${id}`);
		let draft: unknown = null;
		if (draftRaw) {
			try {
				draft = JSON.parse(draftRaw);
			} catch {
				draft = null;
			}
		}

		return {
			series: {
				id: s.id,
				seasonId: s.season_id,
				status: s.status,
				startedAt: s.started_at,
				winningTeam: s.winning_team,
			},
			participants: parts.map((p) => ({
				userId: p.user_id,
				displayName: nameById.get(p.user_id) ?? p.user_id,
				team: p.team,
				role: p.role,
				profileIconUrl: iconById.get(p.user_id) ?? null,
				laneMmr: Math.round(mmrByKey.get(`${p.user_id}|${p.role}`) ?? DEFAULT_MMR),
				history: stats.get(p.user_id) ?? emptyHistory(),
			})),
			games: games.map((g) => ({
				id: g.id,
				gameNumber: g.game_number,
				winningTeam: g.winning_team,
				team1Side: g.team1_side,
				durationSec: g.duration_sec,
				picks: (picksByGame.get(g.id) ?? []).map((p) => {
					const champ = datadragon.findChampion(p.champion_name);
					return {
						team: p.team,
						role: p.role,
						championName: p.champion_name,
						championId: champ ? Number(champ.key) : null,
					};
				}),
				bans: (bansByGame.get(g.id) ?? []).map((b) => {
					const champ = datadragon.findChampion(b.champion_name);
					return {
						team: b.team,
						position: b.position,
						championName: b.champion_name,
						championId: champ ? Number(champ.key) : null,
					};
				}),
			})),
			pickbanDraft: draft,
		};
	});

	// 픽/밴 draft 저장 (full replace) — guild_kv 에 JSON 으로 보관
	app.put<{ Params: { id: string }; Body: unknown }>(
		"/api/series/:id/pickban",
		async (req, reply) => {
			const sid = await requireEditor(req, reply);
			if (!sid) return;

			const id = Number(req.params.id);
			if (!Number.isFinite(id)) return reply.code(400).send({ error: "invalid id" });
			const s = await db.getSeries(id);
			if (!s) return reply.code(404).send({ error: "not found" });
			if (s.status !== "IN_PROGRESS") {
				return reply.code(409).send({ error: `series status is ${s.status}` });
			}

			await db.setKv(`pickban:${id}`, JSON.stringify(req.body), sid);
			// originUser 포함 broadcast — 본인 origin 인 클라이언트는 reload 무시 (입력 보호)
			invalidate(`series:${id}`, sid);
			return { ok: true };
		},
	);

	// 시리즈를 엔트리 수정 대기 상태로 되돌리기 — 게임이 하나도 없을 때만 허용.
	// 시리즈는 CANCELLED 로 마킹 (soft-delete 아님) — 시리즈목록/admin/history 에서 흔적이 보임.
	// 같은 모집을 다시 엔트리 확정하면 createSeries 가 zero-game CANCELLED 행을 revive.
	// audit log 남김 — 추적성 (force-delete 와 동등 수준).
	app.post<{ Params: { id: string } }>("/api/series/:id/revert", async (req, reply) => {
		const sid = await requireEditor(req, reply);
		if (!sid) return;

		const id = Number(req.params.id);
		if (!Number.isFinite(id)) return reply.code(400).send({ error: "invalid id" });
		const s = await db.getSeries(id);
		if (!s) return reply.code(404).send({ error: "not found" });
		if (s.status !== "IN_PROGRESS") {
			return reply.code(409).send({ error: `series status is ${s.status}` });
		}
		const games = await db.listGamesInSeries(id);
		if (games.length > 0) {
			return reply.code(409).send({
				error: `이미 ${games.length}개 게임이 기록된 시리즈는 되돌릴 수 없습니다.`,
			});
		}

		// 모집 찾기 (converted_series_id = id) — 모집 ID = 시리즈 ID 가정 하에 같은 값.
		const recRow = await cloudflare.queryOne<{ id: number }>(
			`SELECT id FROM recruitments WHERE converted_series_id = ?`,
			[id],
		);

		// 1) 모집 status 복원 + converted_series_id NULL
		// 2) 시리즈 CANCELLED 로 마킹 (history-preserving) — 운영자 실수 흔적 보존
		// 3) pickban draft KV 정리 (재확정 시 깨끗한 상태로 시작)
		if (recRow) {
			await db.setRecruitmentStatus(recRow.id, "CLOSED");
		}
		await db.cancelSeries(id);
		await db.deleteKv(`pickban:${id}`);

		await db.recordAudit({
			operatorId: sid,
			action: "series.revert",
			targetType: "series",
			targetId: String(id),
			payload: {
				recruitmentId: recRow?.id ?? null,
				seasonId: s.season_id,
				participants: (await db.getSeriesParticipants(id)).length,
			},
		});

		invalidate(`series:${id}`);
		invalidate("dashboard");
		if (recRow) invalidate(`recruitment:${recRow.id}`);
		// 봇 Discord 모집 메시지 갱신 — 모집이 다시 CLOSED 상태로 보이도록.
		if (recRow) {
			void notifyBotRecruitRefresh(recRow.id).catch((err) => {
				req.log.warn({ err, recruitmentId: recRow.id }, "notifyBotRecruitRefresh failed");
			});
		}
		return { ok: true, recruitmentId: recRow?.id ?? null };
	});
}
