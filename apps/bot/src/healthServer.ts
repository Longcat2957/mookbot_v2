// HEALTHCHECK 용 가벼운 HTTP 서버. inbound 는 컨테이너 내부 (Docker HEALTHCHECK) 만.
// client.isReady() 가 true 일 때만 200, 그 외 503.

import { createServer, type Server } from "node:http";
import type { Client } from "discord.js";

const HEALTH_PORT = Number(process.env.BOT_HEALTH_PORT ?? 3001);

let server: Server | null = null;

export function startHealthServer(client: Client): void {
	if (server) return;
	server = createServer((req, res) => {
		if (req.url === "/healthz") {
			const ready = client.isReady();
			res.writeHead(ready ? 200 : 503, { "content-type": "application/json" });
			res.end(JSON.stringify({ ok: ready, ready }));
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
