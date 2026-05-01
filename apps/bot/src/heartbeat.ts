// 봇 → api 30초 간격 heartbeat. 실패는 stderr 만 (log.error 안 씀 — webhook 도배 방지).

const API_BASE = process.env.INTERNAL_API_BASE ?? "http://api:3000";
const INTERVAL_MS = 30_000;

async function ping(): Promise<void> {
	const key = process.env.INTERNAL_API_KEY;
	if (!key) return; // 미설정 시 silent skip
	try {
		const res = await fetch(`${API_BASE}/internal/heartbeat`, {
			method: "POST",
			headers: { "X-Internal-Key": key },
		});
		if (!res.ok) {
			process.stderr.write(`[heartbeat] api responded ${res.status}\n`);
		}
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		process.stderr.write(`[heartbeat] ${msg}\n`);
	}
}

let timer: NodeJS.Timeout | null = null;

export function startHeartbeat(): void {
	if (timer) return;
	void ping(); // 즉시 첫 발사
	timer = setInterval(() => void ping(), INTERVAL_MS);
	timer.unref();
}

export function stopHeartbeat(): void {
	if (timer) {
		clearInterval(timer);
		timer = null;
	}
}
