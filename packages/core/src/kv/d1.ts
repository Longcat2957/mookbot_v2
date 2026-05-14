import { execute, queryOne } from "../cloudflare/d1.js";
import type { KvSetOptions, KvStore } from "./types.js";

export class D1KvStore implements KvStore {
	async get(key: string): Promise<string | undefined> {
		const row = await queryOne<{ v: string }>(`SELECT v FROM guild_kv WHERE k = ?`, [key]);
		return row?.v;
	}

	async set(key: string, value: string, opts?: KvSetOptions): Promise<void> {
		await execute(
			`INSERT INTO guild_kv (k, v, updated_at, updated_by)
			 VALUES (?, ?, unixepoch(), ?)
			 ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated_at = unixepoch(), updated_by = excluded.updated_by`,
			[key, value, opts?.updatedBy ?? null],
		);
	}

	async delete(key: string): Promise<void> {
		await execute(`DELETE FROM guild_kv WHERE k = ?`, [key]);
	}
}
