import { query, queryOne } from "../cloudflare/d1.js";
import type { Role, Team } from "../mmr/elo.js";

export type Side = "BLUE" | "RED";

export interface GameRow {
	id: number;
	series_id: number;
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
	return query<GameRow>(`SELECT * FROM games WHERE series_id = ? ORDER BY game_number`, [seriesId]);
}

export async function getGameStats(gameId: number): Promise<GameStatRow[]> {
	return query<GameStatRow>(`SELECT * FROM game_stats WHERE game_id = ?`, [gameId]);
}

export interface UserRecentGameRow {
	game_id: number;
	series_id: number;
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

/**
 * 한 사용자의 최근 게임 목록 — Profile 화면용. game_stats / games / mmr_changes JOIN.
 * 본인 perspective (team / side / champion / KDA / W·L / MMR delta).
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
		conditions.push("s.season_id = ?");
		params.push(input.seasonId);
	}
	params.push(limit);
	return query<UserRecentGameRow>(
		`SELECT
		   g.id          AS game_id,
		   g.series_id   AS series_id,
		   g.game_number AS game_number,
		   g.played_at   AS played_at,
		   gs.team       AS team,
		   gs.role       AS role,
		   CASE
		     WHEN gs.team = 'TEAM_1' THEN g.team1_side
		     ELSE CASE WHEN g.team1_side = 'BLUE' THEN 'RED' ELSE 'BLUE' END
		   END           AS side,
		   gs.champion_id,
		   gs.kills, gs.deaths, gs.assists, gs.cs, gs.won,
		   mc.delta      AS mmr_delta,
		   mc.mmr_after  AS mmr_after,
		   s.season_id   AS season_id
		 FROM game_stats gs
		 JOIN games g ON g.id = gs.game_id
		 JOIN series s ON s.id = g.series_id
		 LEFT JOIN mmr_changes mc ON mc.game_id = g.id AND mc.user_id = gs.user_id AND mc.role = gs.role
		 WHERE ${conditions.join(" AND ")} AND s.deleted_at IS NULL
		 ORDER BY g.played_at DESC
		 LIMIT ?`,
		params,
	);
}

/**
 * Count series wins so far per team. Useful for "Bo3 stop at 2 wins" check.
 */
export async function countSeriesWins(seriesId: number): Promise<{ team1: number; team2: number }> {
	const rows = await query<{ winning_team: Team; n: number }>(
		`SELECT winning_team, COUNT(*) AS n FROM games WHERE series_id = ? GROUP BY winning_team`,
		[seriesId],
	);
	const counts = { team1: 0, team2: 0 };
	for (const r of rows) {
		if (r.winning_team === "TEAM_1") counts.team1 = r.n;
		else counts.team2 = r.n;
	}
	return counts;
}
