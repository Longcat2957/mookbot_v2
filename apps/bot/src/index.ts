import { fileURLToPath } from "node:url";
import { datadragon, log } from "@mookbot/core";
import { Client, GatewayIntentBits } from "discord.js";
import { config } from "dotenv";
import { validateEnv } from "./env.js";
import { interactionCreate } from "./events/interactionCreate.js";
import { ready } from "./events/ready.js";
import { startHealthServer, stopHealthServer } from "./healthServer.js";
import { startHeartbeat, stopHeartbeat } from "./heartbeat.js";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
validateEnv();

// Data Dragon 챔피언/스펠/아이템 룩업 초기화 — /전적, /지금게임 의 챔피언 이름
// 매핑에 필요. 정상 로드 시 첫 인터랙션부터 Unknown fallback 을 피한다.
try {
	await datadragon.initDataDragon();
	log.info({ ddVersion: datadragon.getVersion() }, "datadragon ready");
} catch (err: unknown) {
	log.warn({ err }, "datadragon init failed");
}

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers, // /일괄등록 — 길드 전체 멤버 fetch (privileged intent)
	],
});

client.on("ready", () => {
	ready(client);
	startHealthServer(client);
	startHeartbeat();
});
client.on("interactionCreate", (i) => interactionCreate(i));

const shutdown = (signal: string) => {
	log.info({ signal }, "shutting down");
	stopHeartbeat();
	stopHealthServer();
	client.destroy().finally(() => process.exit(0));
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

client.login(process.env.DISCORD_TOKEN).catch((err) => {
	log.error({ err }, "login failed");
	process.exit(1);
});
