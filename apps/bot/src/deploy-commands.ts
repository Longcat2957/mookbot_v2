import { fileURLToPath } from "node:url";
import { REST, Routes } from "discord.js";
import { config } from "dotenv";
import { ALL_COMMANDS } from "./commands/index.js";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
if (!token || !clientId) throw new Error("DISCORD_TOKEN / CLIENT_ID 미설정");

const rest = new REST({ version: "10" }).setToken(token);

// 모든 슬래시를 Guild Install + Guild context 로 강제 — User Install 모드에서
// invoke 되면 응답이 invoker 한테만 ephemeral 로 보이는 이슈 회피.
//   integration_types: 0 = GUILD_INSTALL, 1 = USER_INSTALL
//   contexts: 0 = GUILD, 1 = BOT_DM, 2 = PRIVATE_CHANNEL
const body = ALL_COMMANDS.map((c) => ({
	...c.data.toJSON(),
	integration_types: [0],
	contexts: [0],
}));

const route = guildId
	? Routes.applicationGuildCommands(clientId, guildId)
	: Routes.applicationCommands(clientId);

const result = (await rest.put(route, { body })) as unknown[];
console.log(`registered ${result.length} commands ${guildId ? `(guild ${guildId})` : "(global)"}`);
