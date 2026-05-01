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
