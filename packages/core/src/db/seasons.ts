import { execute, query, queryOne } from "../cloudflare/d1.js";

export interface SeasonRow {
	id: number;
	name: string;
	started_at: number;
	ended_at: number | null;
	created_at: number;
}

/**
 * Create a new season. Caller is responsible for ending the previous one if needed.
 */
export async function createSeason(name: string): Promise<SeasonRow> {
	const [row] = await query<SeasonRow>(
		`INSERT INTO seasons (name, started_at) VALUES (?, unixepoch()) RETURNING *`,
		[name],
	);
	if (!row) throw new Error("createSeason: failed to insert");
	return row;
}

export async function getCurrentSeason(): Promise<SeasonRow | undefined> {
	return queryOne<SeasonRow>(
		`SELECT * FROM seasons WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1`,
	);
}

export async function getSeason(id: number): Promise<SeasonRow | undefined> {
	return queryOne<SeasonRow>(`SELECT * FROM seasons WHERE id = ?`, [id]);
}

export async function endSeason(id: number): Promise<void> {
	await execute(`UPDATE seasons SET ended_at = unixepoch() WHERE id = ? AND ended_at IS NULL`, [id]);
}
