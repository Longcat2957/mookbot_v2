import { query, queryOne } from "../cloudflare/d1.js";
import type { Role, Team } from "../mmr/elo.js";
import { inClause } from "./sql.js";

export type Side = "BLUE" | "RED";

/**
 * v0.11.0: polymorphic — RANKED 게임은 ranked_series_id, AUCTION 매치 게임은
 * auction_match_id 중 정확히 한 쪽만 NOT NULL (DB CHECK + app invariant).
 */
export interface GameRow {
	id: number;
	ranked_series_id: number | null;
	auction_match_id: number | null;
	game_number: 1 | 2 | 3;
	winning_team: Team;
	team1_side: Side;
	duration_sec: number | null;
	riot_match_id: string | null;
	played_at: number;
}

export interface GameStatRow {
	game_id: number;
	user_id: string;
	team: Team;
	role: Role;
	champion_id: number | null;
	kills: number;
	deaths: number;
	assists: number;
	cs: number;
	won: 0 | 1;
}

export async function getGame(id: number): Promise<GameRow | undefined> {
	return queryOne<GameRow>(`SELECT * FROM games WHERE id = ?`, [id]);
}

export async function listGamesInSeries(seriesId: number): Promise<GameRow[]> {
	return query<GameRow>(`SELECT * FROM games WHERE ranked_series_id = ? ORDER BY game_number`, [
		seriesId,
	]);
}

/**
 * 경매내전 매치의 게임 목록.
 */
export async function listGamesInAuctionMatch(matchId: number): Promise<GameRow[]> {
	return query<GameRow>(`SELECT * FROM games WHERE auction_match_id = ? ORDER BY game_number`, [
		matchId,
	]);
}

export async function getGameStats(gameId: number): Promise<GameStatRow[]> {
	return query<GameStatRow>(`SELECT * FROM game_stats WHERE game_id = ?`, [gameId]);
}

export interface UserRecentGameRow {
	game_id: number;
	ranked_series_id: number | null;
	auction_match_id: number | null;
	game_number: 1 | 2 | 3;
	played_at: number;
	team: Team;
	role: Role;
	side: Side;
	champion_id: number | null;
	kills: number;
	deaths: number;
	assists: number;
	cs: number;
	won: 0 | 1;
	mmr_delta: number | null;
	mmr_after: number | null;
	season_id: number;
}

export interface UserRankedSideRecordRow {
	side: Side;
	games: number;
	wins: number;
}

/**
 * 한 사용자의 최근 게임 목록 — Profile 화면용. game_stats / games / mmr_changes JOIN.
 * 본인 perspective (team / side / champion / KDA / W·L / MMR delta).
 *
 * v0.11.0: RANKED 와 AUCTION 게임 모두 포함 — 누적 챔프 통계가 두 종류 모두
 * 합산되는 기존 동작과 일관. AUCTION 게임은 mmr_delta=NULL (LEFT JOIN).
 * RANKED 는 series.deleted_at IS NULL 필터, AUCTION 은 auction_matches.deleted_at IS NULL.
 */
export async function getRecentGamesForUser(input: {
	userId: string;
	seasonId?: number;
	limit?: number;
}): Promise<UserRecentGameRow[]> {
	const limit = input.limit ?? 20;
	const params: unknown[] = [input.userId];
	const conditions = ["gs.user_id = ?"];
	if (input.seasonId !== undefined) {
		conditions.push("COALESCE(s.season_id, am_season.season_id) = ?");
		params.push(input.seasonId);
	}
	params.push(limit);
	return query<UserRecentGameRow>(
		`SELECT
		   g.id                AS game_id,
		   g.ranked_series_id  AS ranked_series_id,
		   g.auction_match_id  AS auction_match_id,
		   g.game_number       AS game_number,
		   g.played_at         AS played_at,
		   gs.team             AS team,
		   gs.role             AS role,
		   CASE
		     WHEN gs.team = 'TEAM_1' THEN g.team1_side
		     ELSE CASE WHEN g.team1_side = 'BLUE' THEN 'RED' ELSE 'BLUE' END
		   END                 AS side,
		   gs.champion_id,
		   gs.kills, gs.deaths, gs.assists, gs.cs, gs.won,
		   mc.delta            AS mmr_delta,
		   mc.mmr_after        AS mmr_after,
		   COALESCE(s.season_id, am_season.season_id) AS season_id
		 FROM game_stats gs
		 JOIN games g ON g.id = gs.game_id
		 LEFT JOIN series s ON s.id = g.ranked_series_id
		 LEFT JOIN auction_matches am ON am.id = g.auction_match_id
		 LEFT JOIN auction_tournaments am_season ON am_season.id = am.tournament_id
		 LEFT JOIN mmr_changes mc ON mc.game_id = g.id AND mc.user_id = gs.user_id AND mc.role = gs.role
		 WHERE ${conditions.join(" AND ")}
		   AND (s.id IS NULL OR s.deleted_at IS NULL)
		   AND (am.id IS NULL OR (am.deleted_at IS NULL AND am_season.deleted_at IS NULL))
		 ORDER BY g.played_at DESC
		 LIMIT ?`,
		params,
	);
}

/**
 * 한 사용자의 RANKED 게임 사이드별 전적 — Profile 화면용.
 * TEAM_1/TEAM_2 배정은 game.team1_side 기준으로 BLUE/RED 관점으로 변환한다.
 */
export async function getRankedSideRecordsForUser(input: {
	userId: string;
	seasonId?: number;
}): Promise<UserRankedSideRecordRow[]> {
	const params: unknown[] = [input.userId];
	const conditions = ["gs.user_id = ?", "g.ranked_series_id IS NOT NULL"];
	if (input.seasonId !== undefined) {
		conditions.push("s.season_id = ?");
		params.push(input.seasonId);
	}
	return query<UserRankedSideRecordRow>(
		`SELECT
		   CASE
		     WHEN gs.team = 'TEAM_1' THEN g.team1_side
		     ELSE CASE WHEN g.team1_side = 'BLUE' THEN 'RED' ELSE 'BLUE' END
		   END AS side,
		   COUNT(*) AS games,
		   SUM(CASE WHEN gs.won = 1 THEN 1 ELSE 0 END) AS wins
		 FROM game_stats gs
		 JOIN games g ON g.id = gs.game_id
		 JOIN series s ON s.id = g.ranked_series_id
		 WHERE ${conditions.join(" AND ")}
		   AND s.deleted_at IS NULL
		 GROUP BY side`,
		params,
	);
}

export interface HeadToHeadRow {
	user_id: string;
	opponent_id: string;
	role: Role;
	plays: number;
	wins: number;
}

export interface BottomDuoRecordRow {
	bottom_user_id: string;
	support_user_id: string;
	plays: number;
	wins: number;
}

export interface RolePairSynergyInput {
	kind: string;
	roleA: Role;
	roleB: Role;
}

export interface RolePairSynergyRecordRow {
	kind: string;
	role_a: Role;
	role_b: Role;
	user_a_id: string;
	user_b_id: string;
	plays: number;
	wins: number;
}

/**
 * 참가자 풀 안에서 같은 게임·같은 라인으로 맞붙은 상대 전적.
 * user_id 관점의 row 를 반환하므로 A vs B, B vs A 가 각각 별도 row 로 나온다.
 */
export async function listHeadToHeadRecords(input: {
	userIds: readonly string[];
	seasonId?: number;
}): Promise<HeadToHeadRow[]> {
	const userIds = [...new Set(input.userIds)];
	if (userIds.length < 2) return [];
	const userClause = inClause(userIds);
	const opponentClause = inClause(userIds);
	const params: unknown[] = [...userClause.params, ...opponentClause.params];
	const conditions = [
		`a.user_id IN ${userClause.placeholders}`,
		`b.user_id IN ${opponentClause.placeholders}`,
		"a.user_id <> b.user_id",
		"a.team <> b.team",
	];
	if (input.seasonId !== undefined) {
		conditions.push("COALESCE(s.season_id, aut.season_id) = ?");
		params.push(input.seasonId);
	}
	return query<HeadToHeadRow>(
		`SELECT
		   a.user_id AS user_id,
		   b.user_id AS opponent_id,
		   a.role AS role,
		   COUNT(*) AS plays,
		   SUM(CASE WHEN a.won = 1 THEN 1 ELSE 0 END) AS wins
		 FROM game_stats a
		 JOIN game_stats b ON b.game_id = a.game_id AND b.role = a.role
		 JOIN games g ON g.id = a.game_id
		 LEFT JOIN series s ON s.id = g.ranked_series_id
		 LEFT JOIN auction_matches am ON am.id = g.auction_match_id
		 LEFT JOIN auction_tournaments aut ON aut.id = am.tournament_id
		 WHERE ${conditions.join(" AND ")}
		   AND (s.id IS NULL OR s.deleted_at IS NULL)
		   AND (am.id IS NULL OR (am.deleted_at IS NULL AND aut.deleted_at IS NULL))
		 GROUP BY a.user_id, b.user_id, a.role`,
		params,
	);
}

/**
 * 참가자 풀 안에서 같은 팀으로 함께 뛴 원딜+서폿 듀오 전적.
 * bottom_user_id/support_user_id 로 역할을 고정해 한 조합당 한 row 를 반환한다.
 */
export async function listBottomDuoRecords(input: {
	userIds: readonly string[];
	seasonId?: number;
}): Promise<BottomDuoRecordRow[]> {
	const userIds = [...new Set(input.userIds)];
	if (userIds.length < 2) return [];
	const bottomClause = inClause(userIds);
	const supportClause = inClause(userIds);
	const params: unknown[] = [...bottomClause.params, ...supportClause.params];
	const conditions = [
		`bottom.user_id IN ${bottomClause.placeholders}`,
		`support.user_id IN ${supportClause.placeholders}`,
		"bottom.user_id <> support.user_id",
		"bottom.role = 'BOTTOM'",
		"support.role = 'SUPPORT'",
		"bottom.team = support.team",
	];
	if (input.seasonId !== undefined) {
		conditions.push("COALESCE(s.season_id, aut.season_id) = ?");
		params.push(input.seasonId);
	}
	return query<BottomDuoRecordRow>(
		`SELECT
		   bottom.user_id AS bottom_user_id,
		   support.user_id AS support_user_id,
		   COUNT(*) AS plays,
		   SUM(CASE WHEN bottom.won = 1 THEN 1 ELSE 0 END) AS wins
		 FROM game_stats bottom
		 JOIN game_stats support ON support.game_id = bottom.game_id
		 JOIN games g ON g.id = bottom.game_id
		 LEFT JOIN series s ON s.id = g.ranked_series_id
		 LEFT JOIN auction_matches am ON am.id = g.auction_match_id
		 LEFT JOIN auction_tournaments aut ON aut.id = am.tournament_id
		 WHERE ${conditions.join(" AND ")}
		   AND (s.id IS NULL OR s.deleted_at IS NULL)
		   AND (am.id IS NULL OR (am.deleted_at IS NULL AND aut.deleted_at IS NULL))
		 GROUP BY bottom.user_id, support.user_id`,
		params,
	);
}

/**
 * 참가자 풀 안에서 같은 팀으로 함께 뛴 역할 조합 전적.
 * roleA/roleB 방향을 고정해 한 조합당 한 row 를 반환한다.
 */
export async function listRolePairSynergyRecords(input: {
	userIds: readonly string[];
	seasonId?: number;
	pairs: readonly RolePairSynergyInput[];
}): Promise<RolePairSynergyRecordRow[]> {
	const userIds = [...new Set(input.userIds)];
	if (userIds.length < 2 || input.pairs.length === 0) return [];

	const rows = await Promise.all(
		input.pairs.map(async (pair) => {
			const aClause = inClause(userIds);
			const bClause = inClause(userIds);
			const params: unknown[] = [
				pair.kind,
				pair.roleA,
				pair.roleB,
				...aClause.params,
				...bClause.params,
				pair.roleA,
				pair.roleB,
			];
			const conditions = [
				`a.user_id IN ${aClause.placeholders}`,
				`b.user_id IN ${bClause.placeholders}`,
				"a.user_id <> b.user_id",
				"a.role = ?",
				"b.role = ?",
				"a.team = b.team",
			];
			if (input.seasonId !== undefined) {
				conditions.push("COALESCE(s.season_id, aut.season_id) = ?");
				params.push(input.seasonId);
			}
			return query<RolePairSynergyRecordRow>(
				`SELECT
				   ? AS kind,
				   ? AS role_a,
				   ? AS role_b,
				   a.user_id AS user_a_id,
				   b.user_id AS user_b_id,
				   COUNT(*) AS plays,
				   SUM(CASE WHEN a.won = 1 THEN 1 ELSE 0 END) AS wins
				 FROM game_stats a
				 JOIN game_stats b ON b.game_id = a.game_id
				 JOIN games g ON g.id = a.game_id
				 LEFT JOIN series s ON s.id = g.ranked_series_id
				 LEFT JOIN auction_matches am ON am.id = g.auction_match_id
				 LEFT JOIN auction_tournaments aut ON aut.id = am.tournament_id
				 WHERE ${conditions.join(" AND ")}
				   AND (s.id IS NULL OR s.deleted_at IS NULL)
				   AND (am.id IS NULL OR (am.deleted_at IS NULL AND aut.deleted_at IS NULL))
				 GROUP BY a.user_id, b.user_id`,
				params,
			);
		}),
	);

	return rows.flat();
}

/**
 * RANKED 시리즈의 팀별 승수. Useful for "Bo3 stop at 2 wins" check.
 */
export async function countSeriesWins(seriesId: number): Promise<{ team1: number; team2: number }> {
	const rows = await query<{ winning_team: Team; n: number }>(
		`SELECT winning_team, COUNT(*) AS n FROM games WHERE ranked_series_id = ? GROUP BY winning_team`,
		[seriesId],
	);
	const counts = { team1: 0, team2: 0 };
	for (const r of rows) {
		if (r.winning_team === "TEAM_1") counts.team1 = r.n;
		else counts.team2 = r.n;
	}
	return counts;
}

/**
 * AUCTION 매치의 팀별 승수. 동일 패턴, auction_match_id 기준.
 */
export async function countAuctionMatchWins(
	matchId: number,
): Promise<{ team1: number; team2: number }> {
	const rows = await query<{ winning_team: Team; n: number }>(
		`SELECT winning_team, COUNT(*) AS n FROM games WHERE auction_match_id = ? GROUP BY winning_team`,
		[matchId],
	);
	const counts = { team1: 0, team2: 0 };
	for (const r of rows) {
		if (r.winning_team === "TEAM_1") counts.team1 = r.n;
		else counts.team2 = r.n;
	}
	return counts;
}
