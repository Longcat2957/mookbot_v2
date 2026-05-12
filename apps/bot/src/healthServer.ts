// 봇 내부 HTTP 서버 — Docker HEALTHCHECK + api 의 inbound shared-secret 호출 처리.
// 컨테이너 내부 (docker network) 만 노출.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { db, log } from "@mookbot/core";
import type { Client } from "discord.js";
import { refreshRecruitMessageWithClient } from "./commands/recruit/messageBuilder.js";
import { publishSeriesEndCard } from "./commands/series/endCardBuilder.js";

const HEALTH_PORT = Number(process.env.BOT_HEALTH_PORT ?? 3001);

let server: Server | null = null;

export function startHealthServer(client: Client): void {
	if (server) return;
	server = createServer((req, res) => {
		if (req.url === "/healthz") {
			handleHealthz(client, res);
			return;
		}
		if (req.url === "/internal/recruit-refresh" && req.method === "POST") {
			void handleRecruitRefresh(client, req, res);
			return;
		}
		if (req.url === "/internal/series-completed" && req.method === "POST") {
			void handleSeriesCompleted(client, req, res);
			return;
		}
		res.writeHead(404);
		res.end();
	});
	server.listen(HEALTH_PORT, "0.0.0.0");
	server.unref();
}

export function stopHealthServer(): void {
	if (server) {
		server.close();
		server = null;
	}
}

function handleHealthz(client: Client, res: ServerResponse): void {
	const ready = client.isReady();
	res.writeHead(ready ? 200 : 503, { "content-type": "application/json" });
	res.end(JSON.stringify({ ok: ready, ready }));
}

async function handleRecruitRefresh(
	client: Client,
	req: IncomingMessage,
	res: ServerResponse,
): Promise<void> {
	const expected = process.env.INTERNAL_API_KEY;
	if (!expected) {
		res.writeHead(503, { "content-type": "application/json" });
		res.end(JSON.stringify({ error: "INTERNAL_API_KEY not configured" }));
		return;
	}
	const got = req.headers["x-internal-key"];
	if (got !== expected) {
		res.writeHead(401, { "content-type": "application/json" });
		res.end(JSON.stringify({ error: "invalid internal key" }));
		return;
	}

	let body = "";
	req.setEncoding("utf8");
	for await (const chunk of req) body += chunk;

	let parsed: { recruitmentId?: unknown };
	try {
		parsed = JSON.parse(body);
	} catch {
		res.writeHead(400, { "content-type": "application/json" });
		res.end(JSON.stringify({ error: "invalid json" }));
		return;
	}
	const recruitmentId = Number(parsed.recruitmentId);
	if (!Number.isFinite(recruitmentId) || recruitmentId <= 0) {
		res.writeHead(400, { "content-type": "application/json" });
		res.end(JSON.stringify({ error: "recruitmentId required" }));
		return;
	}

	try {
		const rec = await db.getRecruitment(recruitmentId);
		if (!rec) {
			res.writeHead(404, { "content-type": "application/json" });
			res.end(JSON.stringify({ error: "recruitment not found" }));
			return;
		}
		const failure = await refreshRecruitMessageWithClient(
			client,
			recruitmentId,
			rec.channel_id,
			rec.message_id,
		);
		if (failure) {
			log.warn({ recruitmentId, failure }, "recruit-refresh failed");
			res.writeHead(500, { "content-type": "application/json" });
			res.end(JSON.stringify({ error: failure }));
			return;
		}
		res.writeHead(200, { "content-type": "application/json" });
		res.end(JSON.stringify({ ok: true }));
	} catch (err) {
		log.error({ err, recruitmentId }, "recruit-refresh handler crashed");
		res.writeHead(500, { "content-type": "application/json" });
		res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
	}
}

async function handleSeriesCompleted(
	client: Client,
	req: IncomingMessage,
	res: ServerResponse,
): Promise<void> {
	const expected = process.env.INTERNAL_API_KEY;
	if (!expected) {
		res.writeHead(503, { "content-type": "application/json" });
		res.end(JSON.stringify({ error: "INTERNAL_API_KEY not configured" }));
		return;
	}
	const got = req.headers["x-internal-key"];
	if (got !== expected) {
		res.writeHead(401, { "content-type": "application/json" });
		res.end(JSON.stringify({ error: "invalid internal key" }));
		return;
	}

	let body = "";
	req.setEncoding("utf8");
	for await (const chunk of req) body += chunk;

	let parsed: { seriesId?: unknown };
	try {
		parsed = JSON.parse(body);
	} catch {
		res.writeHead(400, { "content-type": "application/json" });
		res.end(JSON.stringify({ error: "invalid json" }));
		return;
	}
	const seriesId = Number(parsed.seriesId);
	if (!Number.isFinite(seriesId) || seriesId <= 0) {
		res.writeHead(400, { "content-type": "application/json" });
		res.end(JSON.stringify({ error: "seriesId required" }));
		return;
	}

	try {
		const failure = await publishSeriesEndCard(client, seriesId);
		if (failure) {
			// 채널 정보 부재 등은 정상 skip — 200 으로 응답해 api 측 로그 깨끗하게.
			log.info({ seriesId, failure }, "series-completed: skipped or non-fatal");
			res.writeHead(200, { "content-type": "application/json" });
			res.end(JSON.stringify({ ok: true, skipped: failure }));
			return;
		}
		res.writeHead(200, { "content-type": "application/json" });
		res.end(JSON.stringify({ ok: true }));
	} catch (err) {
		log.error({ err, seriesId }, "series-completed handler crashed");
		res.writeHead(500, { "content-type": "application/json" });
		res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
	}
}
