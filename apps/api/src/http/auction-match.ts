// 경매 토너먼트 매치 — 매치 생성 / 게임 결과 / 매치 종료 / 토너먼트 자동 종료.
//
// v0.11.0: auction_matches 가 자체 id + lifecycle (status / winning_team) 보유.
// URL 의 :matchId 는 auction_matches.id (옛 :seriesId 와 분리).
// 게임 결과는 `recordGameOnly` 호출 — `mmr_changes` / `user_lane_mmr` 영향 0,
// 그러나 `games` / `game_stats` / `game_picks` / `game_bans` 는 일반 시리즈와
// 같은 테이블 → 사용자 챔프 누적 / 라인별 W/L 자연 통합.

import { cloudflare, datadragon, db } from "@mookbot/core";
import type { FastifyInstance } from "fastify";
import { notifyBotAuctionTournamentCompleted } from "../bot/notify.js";
import { invalidate, requireEditor, requireSession } from "./_helpers.js";
import { type Role, TEAMS, type Team, validateDraftGameInput } from "./auction-match-validation.js";

type MatchRound = "SEMI" | "FINAL" | "SINGLE";
type MatchFormat = "BO1" | "BO3";

export async function registerAuctionMatchRoutes(app: FastifyInstance): Promise<void> {
	// 매치 상세 (브래킷 / 결과 화면용) — match 메타 + games + picks/bans
	app.get<{ Params: { matchId: string } }>("/api/auction-matches/:matchId", async (req, reply) => {
		const sid = requireSession(req, reply);
		if (!sid) return;
		const matchId = Number(req.params.matchId);
		if (!Number.isFinite(matchId)) return reply.code(400).send({ error: "invalid id" });
		const match = await db.getAuctionMatch(matchId);
		if (!match) return reply.code(404).send({ error: "not found" });

		const games = await db.listGamesInAuctionMatch(matchId);
		const [gamePicks, gameBans] = await Promise.all([
			Promise.all(games.map(async (g) => ({ gameId: g.id, picks: await db.getGamePicks(g.id) }))),
			Promise.all(games.map(async (g) => ({ gameId: g.id, bans: await db.getGameBans(g.id) }))),
		]);
		const picksByGame = new Map(gamePicks.map((x) => [x.gameId, x.picks]));
		const bansByGame = new Map(gameBans.map((x) => [x.gameId, x.bans]));

		return {
			match: {
				id: match.id,
				tournamentId: match.tournament_id,
				round: match.round,
				bracketIndex: match.bracket_index,
				team1Id: match.team1_id,
				team2Id: match.team2_id,
				format: match.format,
				status: match.status,
				winningTeam: match.winning_team,
				startedAt: match.started_at,
				endedAt: match.ended_at,
			},
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
		};
	});

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

		// v0.11.0: auction_matches own AUTOINCREMENT id — series 와 별개 풀.
		const match = await db.createAuctionMatch({
			tournamentId,
			round,
			bracketIndex,
			team1Id,
			team2Id,
			format,
			createdBy: sid,
		});

		if (t.status === "BRACKET_SETUP") {
			await db.setAuctionTournamentStatus(tournamentId, "IN_GAME");
		}

		await db.recordAudit({
			operatorId: sid,
			action: "auction-match.created",
			targetType: "auction-match",
			targetId: String(match.id),
			payload: { tournamentId, round, bracketIndex, team1Id, team2Id, format },
		});
		invalidate(`auction-tournament:${tournamentId}`, sid);
		return { matchId: match.id };
	});

	// 매치 게임 결과 입력 — 라인 자유 (Q8): body 가 각 picks 의 userId+role 명시.
	app.post<{
		Params: { matchId: string };
		Body: {
			gameNumber: 1 | 2 | 3;
			team1Side: "BLUE" | "RED";
			winningTeam: Team;
			durationMin?: number;
			picks: {
				TEAM_1: { userId: string; role: Role; championId: number }[];
				TEAM_2: { userId: string; role: Role; championId: number }[];
			};
			bans: { TEAM_1: number[]; TEAM_2: number[] };
		};
	}>("/api/auction-matches/:matchId/games", async (req, reply) => {
		const sid = await requireEditor(req, reply);
		if (!sid) return;
		const matchId = Number(req.params.matchId);
		if (!Number.isFinite(matchId)) return reply.code(400).send({ error: "invalid id" });
		const match = await db.getAuctionMatch(matchId);
		if (!match) return reply.code(404).send({ error: "auction match not found" });
		if (match.status !== "IN_PROGRESS") {
			return reply.code(409).send({ error: `match status=${match.status}` });
		}

		const body = req.body;
		if (!body || ![1, 2, 3].includes(body.gameNumber)) {
			return reply.code(400).send({ error: "gameNumber 1/2/3" });
		}
		if (body.gameNumber > 1 && match.format === "BO1") {
			return reply.code(409).send({ error: "BO1 매치는 game 1 만" });
		}
		const [team1Members, team2Members] = await Promise.all([
			db.listAuctionTeamMembers(match.team1_id),
			db.listAuctionTeamMembers(match.team2_id),
		]);
		const validationError = validateDraftGameInput({
			team1Members: new Set(team1Members.map((m) => m.user_id)),
			team2Members: new Set(team2Members.map((m) => m.user_id)),
			picks: body.picks,
			bans: body.bans,
			team1Side: body.team1Side,
			winningTeam: body.winningTeam,
		});
		if (validationError) return reply.code(400).send({ error: validationError });

		// 같은 게임번호 중복 가드
		const existing = await db.listGamesInAuctionMatch(matchId);
		if (existing.some((g) => g.game_number === body.gameNumber)) {
			return reply.code(409).send({ error: `Game ${body.gameNumber} 이미 기록됨` });
		}

		// participants for recordGameOnly — 각 picks 의 userId + team + role
		const participants: Array<{ userId: string; team: Team; role: Role }> = [];
		const picksFlat: { team: Team; role: Role; championName: string }[] = [];
		const stats: Array<{ userId: string; championId: number }> = [];
		for (const team of TEAMS) {
			for (const p of body.picks[team]) {
				participants.push({ userId: p.userId, team, role: p.role });
				stats.push({ userId: p.userId, championId: p.championId });
				picksFlat.push({
					team,
					role: p.role,
					championName: datadragon.getChampionName(p.championId),
				});
			}
		}

		const result = await db.recordGameOnly({
			auctionMatchId: matchId,
			gameNumber: body.gameNumber,
			winningTeam: body.winningTeam,
			team1Side: body.team1Side,
			...(body.durationMin ? { durationSec: body.durationMin * 60 } : {}),
			stats,
			participants,
		});

		// picks / bans 별도 INSERT
		await db.setGamePicks(result.game.id, picksFlat);
		const bansFlat: { team: Team; position: number; championName: string }[] = [];
		for (const team of TEAMS) {
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
		const wins = await db.countAuctionMatchWins(matchId);
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
			await db.completeAuctionMatch(matchId, matchWinningTeam);

			// 토너먼트 전체 종료 검사 — FINAL 또는 SINGLE 매치가 COMPLETED 면 챔피언 결정.
			const allMatches = await db.listAuctionMatches(match.tournament_id);
			const finalMatch = allMatches.find(
				(m) => (m.round === "FINAL" || m.round === "SINGLE") && m.status === "COMPLETED",
			);
			if (finalMatch?.winning_team) {
				const championTeamId =
					finalMatch.winning_team === "TEAM_1" ? finalMatch.team1_id : finalMatch.team2_id;
				await db.completeAuctionTournament(match.tournament_id, championTeamId);
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
			targetId: String(matchId),
			payload: {
				gameNumber: body.gameNumber,
				winningTeam: body.winningTeam,
				matchCompleted,
				matchWinningTeam,
			},
		});

		invalidate(`auction-tournament:${match.tournament_id}`, sid);
		invalidate(`auction-match:${matchId}`, sid);
		return {
			gameId: result.game.id,
			wins,
			matchCompleted,
			matchWinningTeam,
		};
	});

	// 직전 게임 되돌리기 — game DELETE + CASCADE + 매치 / 토너먼트 status 복원
	app.delete<{ Params: { matchId: string } }>(
		"/api/auction-matches/:matchId/games/last",
		async (req, reply) => {
			const sid = await requireEditor(req, reply);
			if (!sid) return;
			const matchId = Number(req.params.matchId);
			if (!Number.isFinite(matchId)) return reply.code(400).send({ error: "invalid id" });
			const match = await db.getAuctionMatch(matchId);
			if (!match) return reply.code(404).send({ error: "auction match not found" });
			if (match.status === "CANCELLED") {
				return reply.code(409).send({ error: "취소된 매치는 되돌릴 수 없음" });
			}

			const games = await db.listGamesInAuctionMatch(matchId);
			if (games.length === 0) return reply.code(409).send({ error: "되돌릴 게임이 없음" });
			const last = games.at(-1);
			if (!last) return reply.code(409).send({ error: "되돌릴 게임이 없음" });
			await cloudflare.execute(`DELETE FROM games WHERE id = ?`, [last.id]);

			// 매치가 COMPLETED 였으면 IN_PROGRESS 복원
			if (match.status === "COMPLETED") {
				await db.restoreAuctionMatchInProgress(matchId);
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
				targetId: String(matchId),
				payload: { gameNumber: last.game_number },
			});
			invalidate(`auction-tournament:${match.tournament_id}`, sid);
			invalidate(`auction-match:${matchId}`, sid);
			return { ok: true, deletedGame: last.game_number };
		},
	);

	// 매치 BO1/BO3 변경 (운영자) — 게임 0개일 때만
	app.put<{
		Params: { matchId: string };
		Body: { format: MatchFormat };
	}>("/api/auction-matches/:matchId/format", async (req, reply) => {
		const sid = await requireEditor(req, reply);
		if (!sid) return;
		const matchId = Number(req.params.matchId);
		const match = await db.getAuctionMatch(matchId);
		if (!match) return reply.code(404).send({ error: "not found" });
		const games = await db.listGamesInAuctionMatch(matchId);
		if (games.length > 0) {
			return reply.code(409).send({ error: "이미 기록된 게임이 있어 변경 불가" });
		}
		await db.setAuctionMatchFormat(matchId, req.body.format);
		invalidate(`auction-tournament:${match.tournament_id}`, sid);
		return { ok: true };
	});
}
