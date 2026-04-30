// WebSocket 룸 — topic 기반 broadcast.
// topic 예: "series:42", "recruitment:5", "dashboard"
// 서버 측 write 엔드포인트가 변경 후 broadcast(topic, msg) 호출 → 룸 참가자 즉시 invalidate.

import type { WebSocket } from "@fastify/websocket";

const rooms = new Map<string, Set<WebSocket>>();

export function joinRoom(topic: string, socket: WebSocket): void {
	let room = rooms.get(topic);
	if (!room) {
		room = new Set();
		rooms.set(topic, room);
	}
	room.add(socket);
}

export function leaveAllRooms(socket: WebSocket): void {
	for (const [topic, room] of rooms) {
		if (room.delete(socket) && room.size === 0) {
			rooms.delete(topic);
		}
	}
}

export function broadcast(topic: string, msg: unknown): void {
	const room = rooms.get(topic);
	if (!room || room.size === 0) return;
	const data = JSON.stringify(msg);
	for (const ws of room) {
		try {
			ws.send(data);
		} catch {
			// 끊긴 소켓은 무시 — close 핸들러가 정리
		}
	}
}

export function roomStats(): { topic: string; count: number }[] {
	return [...rooms.entries()].map(([topic, room]) => ({ topic, count: room.size }));
}
