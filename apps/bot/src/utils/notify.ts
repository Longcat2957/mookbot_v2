// 봇 → api WS 룸에 invalidate 알림.
// shared secret (INTERNAL_API_KEY) 로 인증, 같은 VPS docker network 내부 호출.
// 실패해도 봇 동작에 영향 없음 (best-effort).

import { log } from "@mookbot/core";

export async function notify(topic: string): Promise<void> {
	// dotenv config() 가 import 보다 늦게 실행되는 경우 (로컬 dev tsx watch)
	// 에도 정상 동작하도록 호출 시점에 evaluate.
	const apiBase = process.env.INTERNAL_API_BASE ?? "http://api:3000";
	const key = process.env.INTERNAL_API_KEY;
	if (!key) return; // 미설정 시 silent skip

	try {
		await fetch(`${apiBase}/internal/notify`, {
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
