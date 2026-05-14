import { Redis } from "ioredis";
import { log } from "../logger.js";
import { D1KvStore } from "./d1.js";
import { RedisKvStore } from "./redis.js";
import { RoutedKvStore } from "./routed.js";
import type { KvStore } from "./types.js";

let kvStore: KvStore | null = null;
let pubClient: Redis | null = null;
let subClient: Redis | null = null;
let initialized = false;

function buildClient(label: string): Redis {
	const url = process.env.REDIS_URL;
	if (!url) throw new Error("buildClient called without REDIS_URL");
	const client = new Redis(url, {
		maxRetriesPerRequest: 3,
		enableReadyCheck: true,
		lazyConnect: false,
	});
	client.on("error", (err: Error) => {
		log.error({ err, role: label }, "Redis client error");
	});
	return client;
}

function ensureInit(): void {
	if (initialized) return;
	const url = process.env.REDIS_URL;
	if (!url) {
		log.warn("Redis: REDIS_URL 미설정 — KV D1 폴백 + WS in-process broadcast (dev/test 만 권장)");
		kvStore = new D1KvStore();
		initialized = true;
		return;
	}
	pubClient = buildClient("publisher");
	kvStore = new RoutedKvStore(new RedisKvStore(pubClient), new D1KvStore());
	log.info({ url: url.replace(/:[^@/]*@/, ":***@") }, "Redis backend ready");
	initialized = true;
}

export function getKvStore(): KvStore {
	ensureInit();
	if (!kvStore) throw new Error("KV store not initialized");
	return kvStore;
}

/**
 * 일반 명령 + Pub/Sub PUBLISH 용 client. REDIS_URL 미설정 시 null.
 * 동일 client 가 KV (get/set/del) + PUBLISH 모두 처리.
 */
export function getRedisClient(): Redis | null {
	ensureInit();
	return pubClient;
}

/**
 * Pub/Sub SUBSCRIBE 전용 client. ioredis 는 subscribe 모드에서 일반 명령 차단되므로
 * publisher 와 분리 필요. REDIS_URL 미설정 시 null.
 *
 * 최초 호출 시 lazy 생성.
 */
export function getRedisSubscriber(): Redis | null {
	ensureInit();
	if (!process.env.REDIS_URL) return null;
	if (!subClient) {
		subClient = buildClient("subscriber");
	}
	return subClient;
}

export async function closeRedis(): Promise<void> {
	const tasks: Promise<unknown>[] = [];
	if (pubClient) tasks.push(pubClient.quit().catch(() => undefined));
	if (subClient) tasks.push(subClient.quit().catch(() => undefined));
	await Promise.all(tasks);
	pubClient = null;
	subClient = null;
	kvStore = null;
	initialized = false;
}

// 테스트 전용 — 캐시된 싱글톤 교체 / 리셋.
export function __setKvStoreForTest(store: KvStore | null): void {
	kvStore = store;
	initialized = store !== null;
}

export function __resetRedisForTest(): void {
	kvStore = null;
	pubClient = null;
	subClient = null;
	initialized = false;
}
