// 경매내전 입찰 의도 (transient) — 운영자가 입력 중인 가격을 다른 화면에 실시간 공유.
//
// Redis 백엔드 (REDIS_URL 설정 시):
//   key   = "bidIntent:<tournamentId>"
//   field = "<teamId>"
//   value = JSON.stringify({ points, updatedAt })
//   TTL   = 1h (BIDDING 단계 자동 만료)
// 다중 api 인스턴스 / api 재시작 후에도 의도 유지 → 운영자 UX 신뢰성.
//
// REDIS_URL 미설정 (dev/test) 시: in-process Map 폴백.

import { getRedisClient } from "@mookbot/core";

interface BidIntent {
	points: number;
	updatedAt: number;
}

const TTL_SEC = 60 * 60;

function key(tournamentId: number): string {
	return `bidIntent:${tournamentId}`;
}

// in-process 폴백 — Redis 없을 때 (dev/test) 만 사용
const fallbackStore = new Map<number, Map<number, BidIntent>>();

export async function getBidIntents(
	tournamentId: number,
): Promise<Array<{ teamId: number; points: number }>> {
	const redis = getRedisClient();
	if (redis) {
		const obj = (await redis.hgetall(key(tournamentId))) as Record<string, string>;
		const out: Array<{ teamId: number; points: number }> = [];
		for (const [teamIdStr, raw] of Object.entries(obj)) {
			try {
				const parsed = JSON.parse(raw) as BidIntent;
				out.push({ teamId: Number(teamIdStr), points: parsed.points });
			} catch {
				// invalid JSON — skip
			}
		}
		out.sort((a, b) => a.teamId - b.teamId);
		return out;
	}
	const inner = fallbackStore.get(tournamentId);
	if (!inner) return [];
	const out: Array<{ teamId: number; points: number }> = [];
	for (const [teamId, intent] of inner) {
		out.push({ teamId, points: intent.points });
	}
	out.sort((a, b) => a.teamId - b.teamId);
	return out;
}

export async function setBidIntent(
	tournamentId: number,
	teamId: number,
	points: number | null,
): Promise<void> {
	const redis = getRedisClient();
	if (redis) {
		if (points === null) {
			await redis.hdel(key(tournamentId), String(teamId));
			return;
		}
		const intent: BidIntent = { points, updatedAt: Date.now() };
		await redis.hset(key(tournamentId), String(teamId), JSON.stringify(intent));
		await redis.expire(key(tournamentId), TTL_SEC);
		return;
	}
	if (points === null) {
		const inner = fallbackStore.get(tournamentId);
		if (!inner) return;
		inner.delete(teamId);
		if (inner.size === 0) fallbackStore.delete(tournamentId);
		return;
	}
	let inner = fallbackStore.get(tournamentId);
	if (!inner) {
		inner = new Map();
		fallbackStore.set(tournamentId, inner);
	}
	inner.set(teamId, { points, updatedAt: Date.now() });
}

export async function clearBidIntents(tournamentId: number): Promise<void> {
	const redis = getRedisClient();
	if (redis) {
		await redis.del(key(tournamentId));
		return;
	}
	fallbackStore.delete(tournamentId);
}

// 테스트 / 디버깅용 — 모든 store reset
export async function _resetAllBidIntents(): Promise<void> {
	const redis = getRedisClient();
	if (redis) {
		const keys = await redis.keys("bidIntent:*");
		if (keys.length > 0) await redis.del(...keys);
	}
	fallbackStore.clear();
}
