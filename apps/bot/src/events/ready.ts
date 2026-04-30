import type { Client } from "discord.js";
import { log } from "@mookbot/core";

export function ready(client: Client): void {
	log.info({ user: client.user?.tag, guilds: client.guilds.cache.size }, "bot ready");
}
