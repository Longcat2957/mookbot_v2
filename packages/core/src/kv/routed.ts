import type { KvSetOptions, KvStore } from "./types.js";

// Redis 로 라우팅할 prefix. 그 외 모든 키는 D1 (영구) 로.
//   entry:*    — EntryEditing 드래프트 (ephemeral, 다중 PUT)
//   pickban:*  — PickBan 드래프트 (ephemeral, 다중 PUT)
//   cache:*    — read-through 캐시 (TTL 의미 강함)
const REDIS_PREFIXES = ["entry:", "pickban:", "cache:"] as const;

export class RoutedKvStore implements KvStore {
	constructor(
		private redis: KvStore,
		private d1: KvStore,
	) {}

	private pick(key: string): KvStore {
		return REDIS_PREFIXES.some((p) => key.startsWith(p)) ? this.redis : this.d1;
	}

	get(key: string): Promise<string | undefined> {
		return this.pick(key).get(key);
	}

	set(key: string, value: string, opts?: KvSetOptions): Promise<void> {
		return this.pick(key).set(key, value, opts);
	}

	delete(key: string): Promise<void> {
		return this.pick(key).delete(key);
	}
}
