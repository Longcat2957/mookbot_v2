import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { Client, GatewayIntentBits } from "discord.js";
import { log } from "@mookbot/core";
import { ready } from "./events/ready.js";
import { interactionCreate } from "./events/interactionCreate.js";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers, // /일괄등록 — 길드 전체 멤버 fetch (privileged intent)
	],
});

client.on("ready", () => ready(client));
client.on("interactionCreate", (i) => interactionCreate(i));

const shutdown = (signal: string) => {
	log.info({ signal }, "shutting down");
	client.destroy().finally(() => process.exit(0));
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

client.login(process.env.DISCORD_TOKEN).catch((err) => {
	log.error({ err }, "login failed");
	process.exit(1);
});
