// 헬스체크 라우트 + 봇 heartbeat 추적.
// - GET /healthz       : 얕은 (HEALTHCHECK 용, DB 안 건드림)
// - GET /healthz/deep  : 깊은 (D1 ping + bot heartbeat age — UptimeRobot 용)
// - recordBotHeartbeat(): /internal/heartbeat 라우트가 호출

import type { FastifyInstance } from "fastify";
import { cloudflare } from "@mookbot/core";

const apiStartMs = Date.now();
const STARTUP_GRACE_MS = 90_000; // 봇이 startup 직후 heartbeat 못 보내도 90s 그레이스
const BOT_STALE_MS = 90_000; // 마지막 ping 후 90s 넘으면 stale
const D1_PING_TIMEOUT_MS = 1_000;

let lastBotPingMs: number | null = null;

export function recordBotHeartbeat(): void {
	lastBotPingMs = Date.now();
}

async function pingD1(): Promise<{ ok: true } | { ok: false; error: string }> {
	const ac = new AbortController();
	const t = setTimeout(() => ac.abort(), D1_PING_TIMEOUT_MS);
	try {
		await cloudflare.query("SELECT 1 AS ok");
		return { ok: true };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	} finally {
		clearTimeout(t);
	}
}

interface DeepResponse {
	ok: boolean;
	uptimeSec: number;
	db: "ok" | "fail";
	dbError?: string;
	botHeartbeat: "ok" | "stale" | "missing";
	botPingAgeSec: number | null;
}

export async function registerHealthzRoutes(app: FastifyInstance): Promise<void> {
	app.get("/healthz/deep", async (_req, reply) => {
		const now = Date.now();
		const uptimeSec = Math.floor((now - apiStartMs) / 1000);

		const dbResult = await pingD1();

		let botHeartbeat: DeepResponse["botHeartbeat"];
		let botPingAgeSec: number | null = null;
		if (lastBotPingMs == null) {
			botHeartbeat = now - apiStartMs < STARTUP_GRACE_MS ? "ok" : "missing";
		} else {
			const ageMs = now - lastBotPingMs;
			botPingAgeSec = Math.floor(ageMs / 1000);
			botHeartbeat = ageMs < BOT_STALE_MS ? "ok" : "stale";
		}

		const ok = dbResult.ok && botHeartbeat === "ok";
		const body: DeepResponse = {
			ok,
			uptimeSec,
			db: dbResult.ok ? "ok" : "fail",
			botHeartbeat,
			botPingAgeSec,
		};
		if (!dbResult.ok) body.dbError = dbResult.error;

		return reply.code(ok ? 200 : 503).send(body);
	});
}
