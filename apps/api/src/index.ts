import { fileURLToPath } from "node:url";
import cookie from "@fastify/cookie";
import websocket from "@fastify/websocket";
import { datadragon, log } from "@mookbot/core";
import { config } from "dotenv";
import Fastify from "fastify";
import { validateEnv } from "./env.js";
import { fastifyErrorHandler } from "./http/_errors.js";
import { registerRoutes } from "./http/routes.js";
import { registerWs } from "./ws/server.js";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
validateEnv();

const app = Fastify({
	logger: { level: process.env.LOG_LEVEL ?? "info" },
	trustProxy: true,
});

app.setErrorHandler(fastifyErrorHandler);

await app.register(cookie, {
	secret: process.env.SESSION_SECRET ?? "dev-only-change-me",
});
await app.register(websocket);

await registerRoutes(app);
await registerWs(app);

// Data Dragon 챔피언/스펠/아이템 룩업 초기화 — fail-soft (네트워크 일시 장애시 graceful)
datadragon
	.initDataDragon()
	.then(() => log.info({ ddVersion: datadragon.getVersion() }, "datadragon ready"))
	.catch((err: unknown) => log.warn({ err }, "datadragon init failed"));

const port = Number(process.env.API_PORT ?? 3000);
const host = process.env.API_HOST ?? "0.0.0.0";

await app.listen({ port, host });
log.info({ port, host }, "api listening");
