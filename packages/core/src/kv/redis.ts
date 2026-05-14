import type { Redis } from "ioredis";
import type { KvSetOptions, KvStore } from "./types.js";

export class RedisKvStore implements KvStore {
	constructor(private client: Redis) {}

	async get(key: string): Promise<string | undefined> {
		const v = await this.client.get(key);
		return v ?? undefined;
	}

	async set(key: string, value: string, opts?: KvSetOptions): Promise<void> {
		if (opts?.ttlSec && opts.ttlSec > 0) {
			await this.client.set(key, value, "EX", opts.ttlSec);
		} else {
			await this.client.set(key, value);
		}
	}

	async delete(key: string): Promise<void> {
		await this.client.del(key);
	}
}
