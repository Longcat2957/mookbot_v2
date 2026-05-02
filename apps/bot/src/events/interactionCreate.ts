import { log } from "@mookbot/core";
import type { Interaction } from "discord.js";
import { handleButton as cleanupStaleButton } from "../commands/cleanupStale.js";
import { handleButton as earlyCompleteSeriesButton } from "../commands/earlyCompleteSeries.js";
import { handleButton as forceDeleteRecruitmentButton } from "../commands/forceDeleteRecruitment.js";
import { handleButton as forceDeleteSeriesButton } from "../commands/forceDeleteSeries.js";
import { ALL_COMMANDS } from "../commands/index.js";
import {
	handleButton as recruitButton,
	handleStringSelect as recruitStringSelect,
} from "../commands/recruit.js";
import { handleButton as resetSeasonButton } from "../commands/resetSeasonResults.js";

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
		await interaction.reply({ content: `❌ 오류: ${msg}`, ephemeral: true }).catch(() => undefined);
	}
}

export async function interactionCreate(interaction: Interaction) {
	if (interaction.isButton()) {
		try {
			const prefix = prefixOf(interaction.customId);
			if (prefix === "recruit") {
				await recruitButton(interaction);
			} else if (prefix === "admin") {
				const action = interaction.customId.split(":")[2];
				if (action === "series_force_delete") await forceDeleteSeriesButton(interaction);
				else if (action === "recruitment_force_delete") await forceDeleteRecruitmentButton(interaction);
				else if (action === "series_early_complete") await earlyCompleteSeriesButton(interaction);
				else if (action === "season_reset") await resetSeasonButton(interaction);
				else if (action === "cleanup_stale") await cleanupStaleButton(interaction);
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
