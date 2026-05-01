import { fileURLToPath } from "node:url";
import { log } from "@mookbot/core";
import { Client, GatewayIntentBits } from "discord.js";
import { config } from "dotenv";
import { validateEnv } from "./env.js";
import { interactionCreate } from "./events/interactionCreate.js";
import { ready } from "./events/ready.js";
import { startHealthServer, stopHealthServer } from "./healthServer.js";
import { startHeartbeat, stopHeartbeat } from "./heartbeat.js";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
validateEnv();

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
