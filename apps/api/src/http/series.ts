// 시리즈 생성 / 목록 / 상세 / 종료된 시리즈 / pickban draft / revert.
// 게임 결과 입력 (POST games / DELETE last) 은 ./games.ts 분리.

import { cloudflare, datadragon, db } from "@mookbot/core";
import type { FastifyInstance } from "fastify";
import { HttpError } from "./_errors.js";
import { invalidate, requireEditor, requireSession } from "./_helpers.js";
import { emptyHistory, fetchPlayHistoryFor } from "./_history.js";

const { getRecruitment } = db;

export async function registerSeriesRoutes(app: FastifyInstance): Promise<void> {
	// 시리즈 생성 — 엔트리 수정에서 [엔트리 제출] 시 호출.
	// 모집의 status 를 CONVERTED 로 전이 + series row + series_participants insert.
	app.post<{
		Body: {
			recruitmentId: number;
			assignments: { userId: string; team: "TEAM_1" | "TEAM_2"; role: string }[];
		};
	}>("/api/series", async (req, reply) => {
		const sid = await requireEditor(req, reply);
		if (!sid) return;

		const { recruitmentId, assignments } = req.body ?? {};
		if (!recruitmentId || !Array.isArray(assignments)) {
			return reply.code(400).send({ error: "recruitmentId / assignments required" });
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
		await db.setRecruitmentStatus(recruitmentId, "CONVERTED", series.id);
		invalidate("dashboard");
		invalidate(`recruitment:${recruitmentId}`);
		invalidate(`series:${series.id}`);
		return { seriesId: series.id };
	});

	// 종료된 시리즈 목록 (status=COMPLETED) — 지난 내전 기록.
	app.get<{ Querystring: { limit?: string } }>("/api/series/completed", async (req, reply) => {
		const sid = requireSession(req, reply);
		if (!sid) return;

		const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)));
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
				 WHERE status = 'COMPLETED'
				 ORDER BY ended_at DESC
				 LIMIT ?`,
			[limit],
		);
		if (rows.length === 0) return { series: [] };

		const seriesIds = rows.map((s) => s.id);
		const partsAll = await Promise.all(seriesIds.map((id) => db.getSeriesParticipants(id)));
		const allUserIds = [...new Set(partsAll.flat().map((p) => p.user_id))];
		const users = await db.listUsers(allUserIds);
		const nameById = new Map(users.map((u) => [u.discord_id, u.display_name]));

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
				})),
			})),
		};
	});

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
		const users = await db.listUsers(allUserIds);
		const nameById = new Map(users.map((u) => [u.discord_id, u.display_name]));

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
		const users = await db.listUsers(parts.map((p) => p.user_id));
		const nameById = new Map(users.map((u) => [u.discord_id, u.display_name]));
		// PickBan 의 챔프 그리드 "MY MAINS" 표시용 — 참가자 전적/주력 챔프
		const stats = await fetchPlayHistoryFor(parts.map((p) => p.user_id));

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

	// 시리즈를 엔트리 수정 대기 상태로 되돌리기 — 게임이 하나도 없을 때만 허용
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

		// 모집 찾기 (converted_series_id = id)
		const recRow = await cloudflare.queryOne<{ id: number }>(
			`SELECT id FROM recruitments WHERE converted_series_id = ?`,
			[id],
		);

		// 순서 중요 — recruitments.converted_series_id 가 series.id 를 FK 로 참조하므로
		// 1) 모집 status 복원 + converted_series_id NULL 로 설정 (FK 해제)
		// 2) 그 다음 시리즈 DELETE (CASCADE 로 series_participants 정리)
		if (recRow) {
			await db.setRecruitmentStatus(recRow.id, "CLOSED");
		}
		await cloudflare.execute(`DELETE FROM series WHERE id = ?`, [id]);
		await db.deleteKv(`pickban:${id}`);

		invalidate(`series:${id}`);
		invalidate("dashboard");
		if (recRow) invalidate(`recruitment:${recRow.id}`);
		return { ok: true, recruitmentId: recRow?.id ?? null };
	});
}
