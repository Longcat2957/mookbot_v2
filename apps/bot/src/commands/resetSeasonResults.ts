import {
	ActionRowBuilder,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	type ChatInputCommandInteraction,
	EmbedBuilder,
	SlashCommandBuilder,
} from "discord.js";
import { db } from "@mookbot/core";
import { requireOperator } from "../utils/operator.js";

const { inspectSeasonForReset, resetSeasonData, recordAudit, getSeason } = db;

export const data = new SlashCommandBuilder()
	.setName("시즌결과리셋")
	.setDescription("[운영자] 시즌의 모든 시리즈/게임/MMR 데이터 삭제 (시즌 row 자체는 유지)")
	.addIntegerOption((o) =>
		o.setName("season_id").setDescription("리셋할 시즌 ID").setRequired(true).setMinValue(1),
	);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!(await requireOperator(interaction))) return;

	const seasonId = interaction.options.getInteger("season_id", true);
	await interaction.deferReply({ ephemeral: true });

	const season = await getSeason(seasonId);
	if (!season) {
		await interaction.editReply(`❌ 시즌 #${seasonId} 를 찾을 수 없습니다.`);
		return;
	}

	const summary = await inspectSeasonForReset(seasonId);

	const empty =
		summary.seriesCount === 0 &&
		summary.gamesCount === 0 &&
		summary.mmrChangesCount === 0 &&
		summary.laneMmrCount === 0;

	if (empty) {
		await interaction.editReply(`✅ 시즌 #${seasonId} (${season.name}) — 삭제할 데이터 없음.`);
		return;
	}

	const embed = new EmbedBuilder()
		.setTitle(`⚠️ 시즌 #${seasonId} 결과 리셋 미리보기`)
		.setColor(0xe8b339)
		.setDescription(`**${season.name}** 의 모든 시리즈/게임/MMR 변동/라인 MMR 을 삭제합니다.`)
		.addFields(
			{ name: "시리즈", value: String(summary.seriesCount), inline: true },
			{ name: "게임", value: String(summary.gamesCount), inline: true },
			{ name: "MMR 변동", value: String(summary.mmrChangesCount), inline: true },
			{ name: "라인 MMR", value: String(summary.laneMmrCount), inline: true },
		);

	const confirmId = `admin:confirm:season_reset:${seasonId}`;
	const cancelId = `admin:cancel:season_reset:${seasonId}`;
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setCustomId(confirmId).setLabel("확정 리셋").setStyle(ButtonStyle.Danger),
		new ButtonBuilder().setCustomId(cancelId).setLabel("취소").setStyle(ButtonStyle.Secondary),
	);

	await interaction.editReply({ embeds: [embed], components: [row] });
}

export async function handleButton(interaction: ButtonInteraction): Promise<void> {
	const parts = interaction.customId.split(":");
	if (parts[2] !== "season_reset") return;

	if (!(await requireOperator(interaction))) return;

	if (parts[1] === "cancel") {
		await interaction.update({ content: "취소되었습니다.", embeds: [], components: [] });
		return;
	}

	const seasonId = Number(parts[3]);
	await interaction.deferUpdate();

	const summary = await resetSeasonData(seasonId);

	await recordAudit({
		operatorId: interaction.user.id,
		action: "season.reset",
		targetType: "season",
		targetId: String(seasonId),
		payload: summary as unknown as Record<string, unknown>,
	});

	await interaction.editReply({
		content:
			`✅ 시즌 #${seasonId} 리셋 완료 — 시리즈 ${summary.seriesCount}, 게임 ${summary.gamesCount}, ` +
			`MMR변동 ${summary.mmrChangesCount}, 라인MMR ${summary.laneMmrCount} 건 삭제.`,
		embeds: [],
		components: [],
	});
}
