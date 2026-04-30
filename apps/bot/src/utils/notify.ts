// 봇 → api WS 룸에 invalidate 알림.
// shared secret (INTERNAL_API_KEY) 로 인증, 같은 VPS docker network 내부 호출.
// 실패해도 봇 동작에 영향 없음 (best-effort).

import { log } from "@mookbot/core";

const API_BASE = process.env.INTERNAL_API_BASE ?? "http://api:3000";

export async function notify(topic: string): Promise<void> {
	const key = process.env.INTERNAL_API_KEY;
	if (!key) return; // 미설정 시 silent skip

	try {
		await fetch(`${API_BASE}/internal/notify`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Internal-Key": key,
			},
			body: JSON.stringify({ topic }),
		});
	} catch (err) {
		log.warn({ err, topic }, "notify failed");
	}
}
