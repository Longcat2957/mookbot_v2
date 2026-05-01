// 봇 → api 내부 호출 (shared secret 인증, 같은 docker network).

import type { FastifyInstance } from "fastify";
import { invalidate, requireInternalKey } from "./_helpers.js";
import { recordBotHeartbeat } from "./healthz.js";

export async function registerInternalRoutes(app: FastifyInstance): Promise<void> {
	// 봇이 D1 직접 쓰면서 api 의 WS 룸에 invalidate 를 트리거하기 위한 내부 엔드포인트.
	app.post<{ Body: { topic: string } }>("/internal/notify", async (req, reply) => {
		if (!requireInternalKey(req, reply)) return;
		const { topic } = req.body ?? {};
		if (typeof topic !== "string" || !topic) {
			return reply.code(400).send({ error: "topic required" });
		}
		invalidate(topic);
		return { ok: true };
	});

	// 봇 → api heartbeat (deep healthcheck 용)
	app.post("/internal/heartbeat", async (req, reply) => {
		if (!requireInternalKey(req, reply)) return;
		recordBotHeartbeat();
		return { ok: true };
	});
}
