import { execute, queryOne } from "../cloudflare/d1.js";

export async function getKv(key: string): Promise<string | undefined> {
	const row = await queryOne<{ v: string }>(`SELECT v FROM guild_kv WHERE k = ?`, [key]);
	return row?.v;
}

export async function setKv(key: string, value: string, updatedBy?: string): Promise<void> {
	await execute(
		`INSERT INTO guild_kv (k, v, updated_at, updated_by)
		 VALUES (?, ?, unixepoch(), ?)
		 ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated_at = unixepoch(), updated_by = excluded.updated_by`,
		[key, value, updatedBy ?? null],
	);
}

export async function deleteKv(key: string): Promise<void> {
	await execute(`DELETE FROM guild_kv WHERE k = ?`, [key]);
}
