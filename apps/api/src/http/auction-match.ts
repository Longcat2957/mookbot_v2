// 경매 토너먼트 매치 — 매치 생성 / 게임 결과 / 매치 종료 / 토너먼트 자동 종료.
//
// 게임 결과는 `recordGameOnly` 호출 — `mmr_changes` / `user_lane_mmr` 영향 0,
// 그러나 `games` / `game_stats` / `game_picks` / `game_bans` 는 일반 시리즈와
// 같은 테이블 → 사용자 챔프 누적 / 라인별 W/L 자연 통합.

import { cloudflare, datadragon, db } from "@mookbot/core";
import type { FastifyInstance } from "fastify";
import { notifyBotAuctionTournamentCompleted } from "../bot/notify.js";
import { invalidate, requireEditor } from "./_helpers.js";

type MatchRound = "SEMI" | "FINAL" | "SINGLE";
type MatchFormat = "BO1" | "BO3";
type Team = "TEAM_1" | "TEAM_2";
type Role = "TOP" | "JUNGLE" | "MID" | "BOTTOM" | "SUPPORT";

export async function registerAuctionMatchRoutes(app: FastifyInstance): Promise<void> {
	// 토너먼트의 매치 생성 — 운영자가 round + bracket + 양 팀 + format 결정.
	// 10인 → round='SINGLE', bracketIndex=null, 1매치.
	// 20인 → round='SEMI' bracketIndex=1/2 (4강 2개), 그 뒤 round='FINAL' bracketIndex=null.
	app.post<{
		Params: { id: string };
		Body: {
			round: MatchRound;
			bracketIndex: number | null;
			team1Id: number;
			team2Id: number;
			format: MatchFormat;
		};
	}>("/api/auction-tournaments/:id/matches", async (req, reply) => {
		const sid = await requireEditor(req, reply);
		if (!sid) return;
		const tournamentId = Number(req.params.id);
		const t = await db.getAuctionTournament(tournamentId);
		if (!t) return reply.code(404).send({ error: "not found" });
		if (t.status !== "BRACKET_SETUP" && t.status !== "IN_GAME") {
			return reply.code(409).send({ error: `status=${t.status} — 매치 생성 불가` });
		}

		const { round, bracketIndex, team1Id, team2Id, format } = req.body ?? ({} as never);
		if (!round || !team1Id || !team2Id || !format || team1Id === team2Id) {
			return reply.code(400).send({ error: "round / team1Id / team2Id / format required" });
		}
		// 양 팀의 멤버 5명/팀 확인 + tournament 일치
		const [team1, team2] = await Promise.all([
			db.getAuctionTeam(team1Id),
			db.getAuctionTeam(team2Id),
		]);
		if (!team1 || team1.tournament_id !== tournamentId)
			return reply.code(400).send({ error: "team1 invalid" });
		if (!team2 || team2.tournament_id !== tournamentId)
			return reply.code(400).send({ error: "team2 invalid" });
		const [m1, m2] = await Promise.all([
			db.listAuctionTeamMembers(team1Id),
			db.listAuctionTeamMembers(team2Id),
		]);
		if (m1.length !== 5 || m2.length !== 5) {
			return reply.code(409).send({ error: "팀 멤버 수가 5명/팀 아님" });
		}
		const season = await db.getCurrentSeason();
		if (!season) return reply.code(503).send({ error: "active season 없음" });

		// series.id 는 AUTOINCREMENT — 명시 부여 안 함 (auction_tournament_id 가 grouping)
		// 단, createAuctionMatch 가 명시 id 받으니까 별도 INSERT 후 last_id 사용해야 함
		// → 간단히 series INSERT 결과 id 사용
		const [seriesRow] = await cloudflare.query<{ id: number }>(
			`INSERT INTO series (season_id, status, created_by, type, auction_tournament_id)
			 VALUES (?, 'IN_PROGRESS', ?, 'AUCTION', ?)
			 RETURNING id`,
			[season.id, sid, tournamentId],
		);
		if (!seriesRow) return reply.code(500).send({ error: "series insert failed" });

		// series_participants placeholder + auction_matches 메타
		const ROLE_ORDER: Role[] = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"];
		const spStmts = [
			...m1.map((m, i) => ({
				sql: `INSERT INTO series_participants (series_id, user_id, team, role) VALUES (?, ?, 'TEAM_1', ?)`,
				params: [seriesRow.id, m.user_id, ROLE_ORDER[i]] as unknown[],
			})),
			...m2.map((m, i) => ({
				sql: `INSERT INTO series_participants (series_id, user_id, team, role) VALUES (?, ?, 'TEAM_2', ?)`,
				params: [seriesRow.id, m.user_id, ROLE_ORDER[i]] as unknown[],
			})),
		];
		await cloudflare.batch(spStmts);

		await cloudflare.execute(
			`INSERT INTO auction_matches (series_id, tournament_id, round, bracket_index, team1_id, team2_id, format)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[seriesRow.id, tournamentId, round, bracketIndex, team1Id, team2Id, format],
		);

		if (t.status === "BRACKET_SETUP") {
			await db.setAuctionTournamentStatus(tournamentId, "IN_GAME");
		}

		await db.recordAudit({
			operatorId: sid,
			action: "auction-match.created",
			targetType: "auction-match",
			targetId: String(seriesRow.id),
			payload: { tournamentId, round, bracketIndex, team1Id, team2Id, format },
		});
		invalidate(`auction-tournament:${tournamentId}`, sid);
		return { seriesId: seriesRow.id };
	});

	// 매치 게임 결과 입력 — 라인 자유 (Q8): body 가 각 picks 의 userId+role 명시.
	app.post<{
		Params: { seriesId: string };
		Body: {
			gameNumber: 1 | 2 | 3;
			team1Side: "BLUE" | "RED";
			winningTeam: Team;
			durationMin?: number;
			// 라인 자유 — 매 게임 운영자가 5명을 5라인 배치.
			picks: {
				TEAM_1: { userId: string; role: Role; championId: number }[];
				TEAM_2: { userId: string; role: Role; championId: number }[];
			};
			bans: { TEAM_1: number[]; TEAM_2: number[] };
		};
	}>("/api/auction-matches/:seriesId/games", async (req, reply) => {
		const sid = await requireEditor(req, reply);
		if (!sid) return;
		const seriesId = Number(req.params.seriesId);
		if (!Number.isFinite(seriesId)) return reply.code(400).send({ error: "invalid id" });
		const match = await db.getAuctionMatch(seriesId);
		if (!match) return reply.code(404).send({ error: "auction match not found" });
		const series = await db.getSeries(seriesId);
		if (!series || series.status !== "IN_PROGRESS") {
			return reply.code(409).send({ error: `series status=${series?.status ?? "?"}` });
		}

		const body = req.body;
		if (!body || ![1, 2, 3].includes(body.gameNumber)) {
			return reply.code(400).send({ error: "gameNumber 1/2/3" });
		}
		if (body.gameNumber > 1 && match.format === "BO1") {
			return reply.code(409).send({ error: "BO1 매치는 game 1 만" });
		}

		// 같은 게임번호 중복 가드
		const existing = await db.listGamesInSeries(seriesId);
		if (existing.some((g) => g.game_number === body.gameNumber)) {
			return reply.code(409).send({ error: `Game ${body.gameNumber} 이미 기록됨` });
		}

		// participants for recordGameOnly — 각 picks 의 userId + team + role
		const participants: Array<{ userId: string; team: Team; role: Role }> = [];
		const picksFlat: { team: Team; role: Role; championName: string }[] = [];
		for (const team of ["TEAM_1", "TEAM_2"] as const) {
			for (const p of body.picks[team]) {
				participants.push({ userId: p.userId, team, role: p.role });
				picksFlat.push({
					team,
					role: p.role,
					championName: datadragon.getChampionName(p.championId),
				});
			}
		}

		const result = await db.recordGameOnly({
			seriesId,
			gameNumber: body.gameNumber,
			winningTeam: body.winningTeam,
			team1Side: body.team1Side,
			...(body.durationMin ? { durationSec: body.durationMin * 60 } : {}),
			stats: participants.map((p, i) => ({
				userId: p.userId,
				championId: body.picks[p.team][i % body.picks[p.team].length]!.championId,
			})),
			participants,
		});

		// picks / bans 별도 INSERT
		await db.setGamePicks(result.game.id, picksFlat);
		const bansFlat: { team: Team; position: number; championName: string }[] = [];
		for (const team of ["TEAM_1", "TEAM_2"] as const) {
			body.bans[team].forEach((cid, i) => {
				bansFlat.push({
					team,
					position: i + 1,
					championName: datadragon.getChampionName(cid),
				});
			});
		}
		await db.setGameBans(result.game.id, bansFlat);

		// BO1 또는 BO3 2승 → 매치 종료 검사
		const wins = await db.countSeriesWins(seriesId);
		let matchCompleted = false;
		let matchWinningTeam: Team | null = null;
		if (match.format === "BO1") {
			matchCompleted = true;
			matchWinningTeam = wins.team1 > wins.team2 ? "TEAM_1" : "TEAM_2";
		} else if (wins.team1 >= 2) {
			matchCompleted = true;
			matchWinningTeam = "TEAM_1";
		} else if (wins.team2 >= 2) {
			matchCompleted = true;
			matchWinningTeam = "TEAM_2";
		}
		if (matchCompleted && matchWinningTeam) {
			await db.completeSeries(seriesId, matchWinningTeam);

			// 토너먼트 전체 종료 검사
			const allMatches = await db.listAuctionMatches(match.tournament_id);
			const allSeriesIds = allMatches.map((m) => m.series_id);
			const allSeries =
				allSeriesIds.length > 0
					? await cloudflare.query<{ id: number; status: string; winning_team: Team | null }>(
							`SELECT id, status, winning_team FROM series WHERE id IN (${allSeriesIds.map(() => "?").join(",")})`,
							allSeriesIds,
						)
					: [];
			const completedSeriesIds = allSeries.filter((s) => s.status === "COMPLETED").map((s) => s.id);
			const completedMatches = allMatches.filter((m) => completedSeriesIds.includes(m.series_id));

			// FINAL 또는 SINGLE 매치가 종료됐는지
			const finalMatch = completedMatches.find((m) => m.round === "FINAL" || m.round === "SINGLE");
			if (finalMatch) {
				const finalSeries = allSeries.find((s) => s.id === finalMatch.series_id);
				const championTeamId =
					finalSeries?.winning_team === "TEAM_1" ? finalMatch.team1_id : finalMatch.team2_id;
				await db.completeAuctionTournament(match.tournament_id, championTeamId);
				// 종료 카드 발행 (fire-and-forget — 봇 호출 실패해도 토너먼트 종료는 커밋됨)
				notifyBotAuctionTournamentCompleted(match.tournament_id).catch((err) => {
					req.log.warn(
						{ err, tournamentId: match.tournament_id },
						"notifyBotAuctionTournamentCompleted failed",
					);
				});
			}
		}

		await db.recordAudit({
			operatorId: sid,
			action: "auction-match.game-recorded",
			targetType: "auction-match",
			targetId: String(seriesId),
			payload: {
				gameNumber: body.gameNumber,
				winningTeam: body.winningTeam,
				matchCompleted,
				matchWinningTeam,
			},
		});

		invalidate(`auction-tournament:${match.tournament_id}`, sid);
		invalidate(`auction-match:${seriesId}`, sid);
		return {
			gameId: result.game.id,
			wins,
			matchCompleted,
			matchWinningTeam,
		};
	});

	// 직전 게임 되돌리기 (BO3 안에서) — game DELETE + CASCADE
	app.delete<{ Params: { seriesId: string } }>(
		"/api/auction-matches/:seriesId/games/last",
		async (req, reply) => {
			const sid = await requireEditor(req, reply);
			if (!sid) return;
			const seriesId = Number(req.params.seriesId);
			if (!Number.isFinite(seriesId)) return reply.code(400).send({ error: "invalid id" });
			const match = await db.getAuctionMatch(seriesId);
			if (!match) return reply.code(404).send({ error: "auction match not found" });

			const games = await db.listGamesInSeries(seriesId);
			if (games.length === 0) return reply.code(409).send({ error: "되돌릴 게임이 없음" });
			const last = games[games.length - 1]!;
			await cloudflare.execute(`DELETE FROM games WHERE id = ?`, [last.id]);

			// 시리즈가 COMPLETED 였으면 IN_PROGRESS 복원
			const series = await db.getSeries(seriesId);
			if (series?.status === "COMPLETED") {
				await cloudflare.execute(
					`UPDATE series SET status = 'IN_PROGRESS', winning_team = NULL, ended_at = NULL WHERE id = ?`,
					[seriesId],
				);
			}
			// 토너먼트가 이 매치 결과로 COMPLETED 됐었으면 복원
			const tournament = await db.getAuctionTournament(match.tournament_id);
			if (tournament?.status === "COMPLETED") {
				await cloudflare.execute(
					`UPDATE auction_tournaments SET status = 'IN_GAME', champion_team_id = NULL, ended_at = NULL WHERE id = ?`,
					[match.tournament_id],
				);
			}

			await db.recordAudit({
				operatorId: sid,
				action: "auction-match.game-undone",
				targetType: "auction-match",
				targetId: String(seriesId),
				payload: { gameNumber: last.game_number },
			});
			invalidate(`auction-tournament:${match.tournament_id}`, sid);
			invalidate(`auction-match:${seriesId}`, sid);
			return { ok: true, deletedGame: last.game_number };
		},
	);

	// 매치 BO1/BO3 변경 (운영자) — 게임 0개일 때만
	app.put<{
		Params: { seriesId: string };
		Body: { format: MatchFormat };
	}>("/api/auction-matches/:seriesId/format", async (req, reply) => {
		const sid = await requireEditor(req, reply);
		if (!sid) return;
		const seriesId = Number(req.params.seriesId);
		const match = await db.getAuctionMatch(seriesId);
		if (!match) return reply.code(404).send({ error: "not found" });
		const games = await db.listGamesInSeries(seriesId);
		if (games.length > 0) {
			return reply.code(409).send({ error: "이미 기록된 게임이 있어 변경 불가" });
		}
		await db.setAuctionMatchFormat(seriesId, req.body.format);
		invalidate(`auction-tournament:${match.tournament_id}`, sid);
		return { ok: true };
	});
}
