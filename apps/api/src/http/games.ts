// 게임 결과 입력 (POST) + 직전 게임 되돌리기 (DELETE).
// Bo3 종료 자동 검사 + MMR 변동 + picks/bans INSERT.

import { datadragon, db } from "@mookbot/core";
import type { FastifyInstance } from "fastify";
import { notifyBotSeriesCompleted } from "../bot/notify.js";
import { HttpError } from "./_errors.js";
import { invalidate, requireEditor } from "./_helpers.js";

export async function registerGameRoutes(app: FastifyInstance): Promise<void> {
	// 게임 결과 기록 — picks/bans/side/winner 모두 포함.
	// db.recordGameAndUpdateMmr (game + game_stats + mmr_changes + user_lane_mmr) +
	// db.setGamePicks / setGameBans. Bo3 종료 조건도 같이 검사.
	app.post<{
		Params: { id: string };
		Body: {
			gameNumber: number;
			team1Side: "BLUE" | "RED";
			winningTeam: "TEAM_1" | "TEAM_2";
			durationMin?: number;
			picks: {
				TEAM_1: { role: string; championId: number }[];
				TEAM_2: { role: string; championId: number }[];
			};
			bans: { TEAM_1: number[]; TEAM_2: number[] };
		};
	}>("/api/series/:id/games", async (req, reply) => {
		const sid = await requireEditor(req, reply);
		if (!sid) return;

		const id = Number(req.params.id);
		if (!Number.isFinite(id)) return reply.code(400).send({ error: "invalid id" });
		const s = await db.getSeries(id);
		if (!s) return reply.code(404).send({ error: "not found" });
		if (s.status !== "IN_PROGRESS") {
			return reply.code(409).send({ error: `series status is ${s.status}` });
		}

		const body = req.body;
		if (!body || ![1, 2, 3].includes(body.gameNumber)) {
			return reply.code(400).send({ error: "gameNumber must be 1/2/3" });
		}
		const gameNumber = body.gameNumber as 1 | 2 | 3;

		// Game N 입력은 Game N-1 이 완료된 후에만 가능
		const games = await db.listGamesInSeries(id);
		const completed = new Set<number>(games.map((g) => g.game_number));
		if (gameNumber > 1 && !completed.has(gameNumber - 1)) {
			return reply.code(409).send({ error: `Game ${gameNumber - 1} 결과를 먼저 입력해야 합니다.` });
		}
		if (completed.has(gameNumber)) {
			return reply.code(409).send({ error: `Game ${gameNumber} 은(는) 이미 기록됨` });
		}

		// 참가자 → role/team → userId 매핑
		const parts = await db.getSeriesParticipants(id);
		const userByTeamRole = new Map<string, string>();
		for (const p of parts) userByTeamRole.set(`${p.team}_${p.role}`, p.user_id);

		// picks → PlayerStats[]
		const stats: { userId: string; championId: number }[] = [];
		const picksFlat: { team: "TEAM_1" | "TEAM_2"; role: string; championName: string }[] = [];
		for (const team of ["TEAM_1", "TEAM_2"] as const) {
			for (const pick of body.picks[team]) {
				const userId = userByTeamRole.get(`${team}_${pick.role}`);
				if (!userId) {
					return reply.code(400).send({ error: `${team}/${pick.role} 슬롯에 참가자 없음` });
				}
				stats.push({ userId, championId: pick.championId });
				picksFlat.push({
					team,
					role: pick.role,
					championName: datadragon.getChampionName(pick.championId),
				});
			}
		}

		const bansFlat: { team: "TEAM_1" | "TEAM_2"; position: number; championName: string }[] = [];
		for (const team of ["TEAM_1", "TEAM_2"] as const) {
			body.bans[team].forEach((cid, i) => {
				bansFlat.push({
					team,
					position: i + 1,
					championName: datadragon.getChampionName(cid),
				});
			});
		}

		let result: Awaited<ReturnType<typeof db.recordGameAndUpdateMmr>>;
		try {
			result = await db.recordGameAndUpdateMmr({
				seriesId: id,
				gameNumber,
				winningTeam: body.winningTeam,
				team1Side: body.team1Side,
				...(body.durationMin ? { durationSec: body.durationMin * 60 } : {}),
				stats,
			});
		} catch (err) {
			req.log.error({ err }, "recordGameAndUpdateMmr failed");
			throw new HttpError(400, err instanceof Error ? err.message : String(err));
		}

		// picks / bans 별도 INSERT (record.ts 가 처리하지 않음)
		await db.setGamePicks(
			result.game.id,
			picksFlat.map((p) => ({
				team: p.team,
				role: p.role as "TOP" | "JUNGLE" | "MID" | "BOTTOM" | "SUPPORT",
				championName: p.championName,
			})),
		);
		await db.setGameBans(result.game.id, bansFlat);

		// Bo3 종료 — 한 팀이 2승 도달 시 자동 COMPLETED
		const wins = await db.countSeriesWins(id);
		let completedSeries = false;
		if (wins.team1 >= 2) {
			await db.completeSeries(id, "TEAM_1");
			completedSeries = true;
		} else if (wins.team2 >= 2) {
			await db.completeSeries(id, "TEAM_2");
			completedSeries = true;
		}

		await db.recordAudit({
			operatorId: sid,
			action: "game.recorded",
			targetType: "game",
			targetId: String(result.game.id),
			payload: {
				seriesId: id,
				gameNumber,
				winningTeam: body.winningTeam,
				team1Side: body.team1Side,
			},
		});
		if (completedSeries) {
			await db.recordAudit({
				operatorId: sid,
				action: "series.completed",
				targetType: "series",
				targetId: String(id),
				payload: {
					winningTeam: wins.team1 >= 2 ? "TEAM_1" : "TEAM_2",
					finalScore: { team1: wins.team1, team2: wins.team2 },
				},
			});
		}

		invalidate(`series:${id}`);
		if (completedSeries) invalidate("dashboard");
		// 리더보드 / 영향 받은 유저 프로필 invalidate
		const affectedRoles = new Set(parts.map((p) => p.role));
		for (const r of affectedRoles) invalidate(`leaderboard:${r}`);
		invalidate("leaderboard:COMPOSITE");
		for (const p of parts) invalidate(`user:${p.user_id}`);

		// Bo3 종료 시 — 봇에 시리즈 결과 카드 발행 요청 (모집 채널에).
		// fire-and-forget: 실패해도 게임 결과 INSERT 자체는 이미 커밋됨.
		if (completedSeries) {
			notifyBotSeriesCompleted(id).catch((err) => {
				req.log.warn({ err, seriesId: id }, "notifyBotSeriesCompleted failed");
			});
		}

		return {
			gameId: result.game.id,
			wins,
			completed: completedSeries,
		};
	});

	// 직전 게임 되돌리기 — 공유 db.undoLastGame 사용.
	// 옛 핸들러는 user_lane_mmr.mmr 만 손으로 차감해서 games_played / wins 가
	// 영구히 부풀어 올랐다 (예: recordGame 마다 +1 되는 카운터가 reset 안 됨).
	// 이제 record.ts 의 공유 로직이 mmr / games_played / wins 를 한꺼번에 정리.
	app.delete<{ Params: { id: string } }>("/api/series/:id/games/last", async (req, reply) => {
		const sid = await requireEditor(req, reply);
		if (!sid) return;

		const id = Number(req.params.id);
		if (!Number.isFinite(id)) return reply.code(400).send({ error: "invalid id" });
		const s = await db.getSeries(id);
		if (!s) return reply.code(404).send({ error: "not found" });
		if (s.status === "CANCELLED") {
			return reply.code(409).send({ error: "취소된 시리즈는 되돌릴 수 없습니다." });
		}

		const games = await db.listGamesInSeries(id);
		if (games.length === 0) {
			return reply.code(409).send({ error: "되돌릴 게임이 없습니다." });
		}

		// 참가자 — 캐시 무효화 범위 산정용 (라인 leaderboard + user profile).
		// 영향 받은 유저는 mmr_changes 에 기록된 라인만 정확히 알 수 있지만,
		// 시리즈 참가자가 그 상위 집합이므로 보수적으로 전원 invalidate.
		const parts = await db.getSeriesParticipants(id);

		const result = await db.undoLastGame(id);

		await db.recordAudit({
			operatorId: sid,
			action: "game.undone",
			targetType: "game",
			targetId: String(result.undoneGameId),
			payload: {
				seriesId: id,
				gameNumber: result.undoneGameNumber,
				restoredFromCompleted: result.restoredToInProgress,
			},
		});

		invalidate(`series:${id}`);
		invalidate("dashboard");
		const affectedRoles = new Set(parts.map((p) => p.role));
		for (const r of affectedRoles) invalidate(`leaderboard:${r}`);
		invalidate("leaderboard:COMPOSITE");
		for (const p of parts) invalidate(`user:${p.user_id}`);
		return { ok: true, deletedGame: result.undoneGameNumber };
	});
}
