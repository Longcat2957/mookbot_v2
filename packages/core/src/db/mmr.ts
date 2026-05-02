import { query, queryOne } from "../cloudflare/d1.js";
import type { Role } from "../mmr/elo.js";

export interface LaneMmrRow {
	user_id: string;
	season_id: number;
	role: Role;
	mmr: number;
	games_played: number;
	wins: number;
	updated_at: number;
}

export interface MmrChangeRow {
	id: number;
	game_id: number;
	user_id: string;
	season_id: number;
	role: Role;
	opponent_id: string;
	mmr_before: number;
	mmr_after: number;
	delta: number;
	created_at: number;
}

export async function getLaneMmr(
	userId: string,
	seasonId: number,
	role: Role,
): Promise<LaneMmrRow | undefined> {
	return queryOne<LaneMmrRow>(
		`SELECT * FROM user_lane_mmr WHERE user_id = ? AND season_id = ? AND role = ?`,
		[userId, seasonId, role],
	);
}

/**
 * Bulk-load current MMR for a set of (user_id, role) pairs in one season.
 * Returns only the rows that exist; missing pairs are treated as DEFAULT_MMR by callers.
 */
export async function getLaneMmrs(
	pairs: ReadonlyArray<{ userId: string; role: Role }>,
	seasonId: number,
): Promise<LaneMmrRow[]> {
	if (pairs.length === 0) return [];
	const placeholders = pairs.map(() => "(?, ?)").join(", ");
	const params: unknown[] = [seasonId];
	for (const p of pairs) {
		params.push(p.userId, p.role);
	}
	return query<LaneMmrRow>(
		`SELECT * FROM user_lane_mmr
		 WHERE season_id = ?
		   AND (user_id, role) IN (VALUES ${placeholders})`,
		params,
	);
}

export async function getLeaderboard(
	seasonId: number,
	role: Role,
	limit = 10,
	offset = 0,
): Promise<LaneMmrRow[]> {
	return query<LaneMmrRow>(
		`SELECT * FROM user_lane_mmr
		 WHERE season_id = ? AND role = ? AND games_played > 0
		 ORDER BY mmr DESC
		 LIMIT ? OFFSET ?`,
		[seasonId, role, limit, offset],
	);
}

export async function countLeaderboard(seasonId: number, role: Role): Promise<number> {
	const row = await queryOne<{ n: number }>(
		`SELECT COUNT(*) AS n FROM user_lane_mmr WHERE season_id = ? AND role = ? AND games_played > 0`,
		[seasonId, role],
	);
	return row?.n ?? 0;
}

export async function getMmrChangesForUser(userId: string, limit = 20): Promise<MmrChangeRow[]> {
	return query<MmrChangeRow>(
		`SELECT * FROM mmr_changes WHERE user_id = ?
		 ORDER BY created_at DESC LIMIT ?`,
		[userId, limit],
	);
}

/**
 * 시즌·라인 별 MMR 변동 시계열 — 시간 순 (오래된 → 최신).
 * Profile 화면의 그래프용. seasonId / role 필터 옵션.
 */
export async function getMmrHistoryForUser(input: {
	userId: string;
	seasonId?: number;
	role?: Role;
	limit?: number;
}): Promise<MmrChangeRow[]> {
	const limit = input.limit ?? 100;
	const conditions = ["user_id = ?"];
	const params: unknown[] = [input.userId];
	if (input.seasonId !== undefined) {
		conditions.push("season_id = ?");
		params.push(input.seasonId);
	}
	if (input.role !== undefined) {
		conditions.push("role = ?");
		params.push(input.role);
	}
	params.push(limit);
	return query<MmrChangeRow>(
		`SELECT * FROM mmr_changes WHERE ${conditions.join(" AND ")}
		 ORDER BY created_at ASC
		 LIMIT ?`,
		params,
	);
}

export interface CompositeLeaderboardRow {
	user_id: string;
	weighted_mmr: number;
	total_games: number;
	total_wins: number;
	roles_played: number;
}

/**
 * 통합 랭킹 — 라인 가중평균 MMR (Σ(mmr × games) / Σ(games)).
 * 각 라인별 MMR 의 비중을 그 라인 G 수로 가중 → specialist / generalist 절충.
 * 한 라인이라도 games_played ≥ 1 인 사용자만 집계.
 */
export async function getCompositeLeaderboard(
	seasonId: number,
	limit = 50,
): Promise<CompositeLeaderboardRow[]> {
	return query<CompositeLeaderboardRow>(
		`SELECT
		   user_id,
		   SUM(mmr * games_played) * 1.0 / NULLIF(SUM(games_played), 0) AS weighted_mmr,
		   SUM(games_played) AS total_games,
		   SUM(wins) AS total_wins,
		   COUNT(*) AS roles_played
		 FROM user_lane_mmr
		 WHERE season_id = ? AND games_played >= 1
		 GROUP BY user_id
		 ORDER BY weighted_mmr DESC
		 LIMIT ?`,
		[seasonId, limit],
	);
}

export async function getMmrChangesForGame(gameId: number): Promise<MmrChangeRow[]> {
	return query<MmrChangeRow>(`SELECT * FROM mmr_changes WHERE game_id = ? ORDER BY role`, [gameId]);
}
