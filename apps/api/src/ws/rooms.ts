// WebSocket 룸 — topic 기반 broadcast.
// topic 예: "series:42", "recruitment:5", "dashboard"
// 서버 측 write 엔드포인트가 변경 후 broadcast(topic, msg) 호출 → 룸 참가자 즉시 invalidate.

import type { WebSocket } from "@fastify/websocket";
import { log } from "@mookbot/core";

const rooms = new Map<string, Set<WebSocket>>();

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

export function broadcast(topic: string, msg: unknown): void {
	const room = rooms.get(topic);
	const size = room?.size ?? 0;
	if (!room || size === 0) {
		log.debug({ topic, subscribers: 0 }, "ws broadcast (no subscribers)");
		return;
	}
	const data = JSON.stringify(msg);
	let sent = 0;
	for (const ws of room) {
		try {
			ws.send(data);
			sent++;
		} catch {
			// 끊긴 소켓은 무시 — close 핸들러가 정리
		}
	}
	log.info({ topic, sent, subscribers: size }, "ws broadcast");
}

export function roomStats(): { topic: string; count: number }[] {
	return [...rooms.entries()].map(([topic, room]) => ({ topic, count: room.size }));
}
