import type { Interaction } from "discord.js";
import { log } from "@mookbot/core";
import { ALL_COMMANDS } from "../commands/index.js";
import {
	handleButton as recruitButton,
	handleStringSelect as recruitStringSelect,
	handleUserSelect as recruitUserSelect,
} from "../commands/recruit.js";

function findCommand(name: string) {
	return ALL_COMMANDS.find((c) => c.data.name === name);
}

function prefixOf(customId: string): string | undefined {
	return customId.split(":")[0];
}

async function reportError(
	interaction: Extract<Interaction, { reply: unknown; replied: boolean }>,
	err: unknown,
	tag: string,
): Promise<void> {
	log.error({ err, customId: "customId" in interaction ? interaction.customId : undefined }, tag);
	if (!interaction.replied && !interaction.deferred) {
		const msg = err instanceof Error ? err.message : String(err);
		await interaction
			.reply({ content: `❌ 오류: ${msg}`, ephemeral: true })
			.catch(() => undefined);
	}
}

export async function interactionCreate(interaction: Interaction) {
	if (interaction.isButton()) {
		try {
			if (prefixOf(interaction.customId) === "recruit") {
				await recruitButton(interaction);
			}
		} catch (err) {
			await reportError(interaction, err, "button error");
		}
		return;
	}

	if (interaction.isStringSelectMenu()) {
		try {
			if (prefixOf(interaction.customId) === "recruit") {
				await recruitStringSelect(interaction);
			}
		} catch (err) {
			await reportError(interaction, err, "stringSelect error");
		}
		return;
	}

	if (interaction.isUserSelectMenu()) {
		try {
			if (prefixOf(interaction.customId) === "recruit") {
				await recruitUserSelect(interaction);
			}
		} catch (err) {
			await reportError(interaction, err, "userSelect error");
		}
		return;
	}

	if (!interaction.isChatInputCommand()) return;

	const command = findCommand(interaction.commandName);
	if (!command) return;
	try {
		await command.execute(interaction);
	} catch (err) {
		log.error({ err, command: interaction.commandName }, "execute error");
		const msg = err instanceof Error ? err.message : String(err);
		const reply = { content: `❌ ${msg}`, ephemeral: true } as const;
		if (interaction.deferred || interaction.replied) {
			await interaction.followUp(reply).catch(() => undefined);
		} else {
			await interaction.reply(reply).catch(() => undefined);
		}
	}
}
