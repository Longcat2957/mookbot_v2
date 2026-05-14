// WebSocket 룸 — topic 기반 broadcast.
// topic 예: "series:42", "recruitment:5", "dashboard"
// 서버 측 write 엔드포인트가 변경 후 broadcast(topic, msg) 호출 → 룸 참가자 즉시 invalidate.
//
// Redis Pub/Sub 통합 (REDIS_URL 설정 시):
//   broadcast() → PUBLISH "ws:<topic>" payload
//   각 api 인스턴스가 단일 PSUBSCRIBE "ws:*" → 로컬 소켓 fan-out
//   다중 인스턴스 / 무중단 배포에서 broadcast 가 모든 인스턴스에 전파.
//
// REDIS_URL 미설정 (dev/test) 시: in-process 직접 fan-out (legacy 동작).

import type { WebSocket } from "@fastify/websocket";
import { getRedisClient, getRedisSubscriber, log } from "@mookbot/core";

const rooms = new Map<string, Set<WebSocket>>();

const WS_CHANNEL_PREFIX = "ws:";

let pubsubReady = false;

/**
 * api 부팅 시 1회 호출 — Redis subscriber 초기화 + 메시지 수신 시 로컬 fan-out.
 * REDIS_URL 미설정 시 no-op (legacy in-process broadcast 만 동작).
 */
export async function initWsPubSub(): Promise<void> {
	if (pubsubReady) return;
	const sub = getRedisSubscriber();
	if (!sub) {
		log.info("WS Pub/Sub: REDIS_URL 미설정 — in-process broadcast only");
		pubsubReady = true;
		return;
	}
	sub.on("pmessage", (_pattern: string, channel: string, raw: string) => {
		const topic = channel.startsWith(WS_CHANNEL_PREFIX)
			? channel.slice(WS_CHANNEL_PREFIX.length)
			: channel;
		localBroadcast(topic, raw);
	});
	await sub.psubscribe(`${WS_CHANNEL_PREFIX}*`);
	pubsubReady = true;
	log.info("WS Pub/Sub: Redis psubscribe ws:* ready");
}

export function joinRoom(topic: string, socket: WebSocket): void {
	let room = rooms.get(topic);
	if (!room) {
		room = new Set();
		rooms.set(topic, room);
	}
	room.add(socket);
	log.info({ topic, subscribers: room.size }, "ws join");
}

export function leaveAllRooms(socket: WebSocket): void {
	let leftCount = 0;
	for (const [topic, room] of rooms) {
		if (room.delete(socket)) {
			leftCount++;
			if (room.size === 0) rooms.delete(topic);
		}
	}
	if (leftCount > 0) log.info({ leftCount }, "ws socket disconnect");
}

/**
 * 로컬 소켓 fan-out — Pub/Sub 수신 또는 in-process 폴백에서만 직접 호출.
 * 외부 호출은 `broadcast()` 사용.
 */
function localBroadcast(topic: string, data: string): void {
	const room = rooms.get(topic);
	const size = room?.size ?? 0;
	if (!room || size === 0) {
		log.debug({ topic, subscribers: 0 }, "ws localBroadcast (no subscribers)");
		return;
	}
	let sent = 0;
	for (const ws of room) {
		try {
			ws.send(data);
			sent++;
		} catch {
			// 끊긴 소켓은 무시 — close 핸들러가 정리
		}
	}
	log.info({ topic, sent, subscribers: size }, "ws localBroadcast");
}

/**
 * topic 으로 broadcast. Redis 가 있으면 PUBLISH (모든 인스턴스 전파),
 * 없으면 즉시 in-process fan-out.
 */
export function broadcast(topic: string, msg: unknown): void {
	const data = JSON.stringify(msg);
	const pub = getRedisClient();
	if (pub) {
		pub.publish(`${WS_CHANNEL_PREFIX}${topic}`, data).catch((err: Error) => {
			log.error({ err, topic }, "ws broadcast publish failed — falling back to local");
			localBroadcast(topic, data);
		});
		return;
	}
	localBroadcast(topic, data);
}

export function roomStats(): { topic: string; count: number }[] {
	return [...rooms.entries()].map(([topic, room]) => ({ topic, count: room.size }));
}
