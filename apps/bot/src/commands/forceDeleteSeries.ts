import { db } from "@mookbot/core";
import {
	ActionRowBuilder,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	type ChatInputCommandInteraction,
	EmbedBuilder,
	SlashCommandBuilder,
} from "discord.js";
import { requireOperator } from "../utils/operator.js";

const { inspectSeriesForDelete, forceDeleteSeriesWithRollback, recordAudit, getSeries } = db;

export const data = new SlashCommandBuilder()
	.setName("시리즈강제삭제")
	.setDescription("[운영자] 시리즈와 종속 데이터를 물리 삭제 (선택적 MMR 롤백)")
	.addIntegerOption((o) =>
		o.setName("series_id").setDescription("삭제할 시리즈 ID").setRequired(true).setMinValue(1),
	)
	.addBooleanOption((o) =>
		o.setName("rollback_mmr").setDescription("MMR 누적값 되돌리기 (기본: true)"),
	);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!(await requireOperator(interaction))) return;

	const seriesId = interaction.options.getInteger("series_id", true);
	const rollback = interaction.options.getBoolean("rollback_mmr") ?? true;

	await interaction.deferReply({ ephemeral: true });

	const series = await getSeries(seriesId);
	if (!series) {
		await interaction.editReply(`❌ 시리즈 #${seriesId} 를 찾을 수 없습니다.`);
		return;
	}

	const summary = await inspectSeriesForDelete(seriesId);

	const embed = new EmbedBuilder()
		.setTitle(`⚠️ 시리즈 #${seriesId} 강제 삭제 미리보기`)
		.setColor(0xe8b339)
		.addFields(
			{ name: "상태", value: series.status, inline: true },
			{ name: "게임", value: String(summary.gamesCount), inline: true },
			{ name: "참가자", value: String(summary.participants), inline: true },
			{ name: "MMR 변동 row", value: String(summary.mmrChanges), inline: true },
			{ name: "MMR 롤백", value: rollback ? "✅ 적용" : "❌ 미적용", inline: true },
		)
		.setDescription(
			rollback && summary.rollbackPlan.length > 0
				? `롤백 대상 ${summary.rollbackPlan.length}건\n` +
						summary.rollbackPlan
							.slice(0, 10)
							.map(
								(p) =>
									`• <@${p.userId}> ${p.role} **${p.totalDelta > 0 ? "+" : ""}${p.totalDelta}** (game ${p.gamesPlayed}, win ${p.wins})`,
							)
							.join("\n") +
						(summary.rollbackPlan.length > 10 ? `\n…+${summary.rollbackPlan.length - 10}` : "")
				: "롤백 없이 시리즈/게임/MMR 변동만 삭제",
		);

	const confirmId = `admin:confirm:series_force_delete:${seriesId}:${rollback ? 1 : 0}`;
	const cancelId = `admin:cancel:series_force_delete:${seriesId}`;
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setCustomId(confirmId).setLabel("확정 삭제").setStyle(ButtonStyle.Danger),
		new ButtonBuilder().setCustomId(cancelId).setLabel("취소").setStyle(ButtonStyle.Secondary),
	);

	await interaction.editReply({ embeds: [embed], components: [row] });
}

export async function handleButton(interaction: ButtonInteraction): Promise<void> {
	const parts = interaction.customId.split(":");
	if (parts[2] !== "series_force_delete") return;

	if (!(await requireOperator(interaction))) return;

	if (parts[1] === "cancel") {
		await interaction.update({ content: "취소되었습니다.", embeds: [], components: [] });
		return;
	}

	const seriesId = Number(parts[3]);
	const rollback = parts[4] === "1";

	await interaction.deferUpdate();
	const result = await forceDeleteSeriesWithRollback(seriesId, rollback);

	await recordAudit({
		operatorId: interaction.user.id,
		action: "series.force_delete",
		targetType: "series",
		targetId: String(seriesId),
		payload: { rollback, rollbackRows: result.rollbackRows },
	});

	await interaction.editReply({
		content: `✅ 시리즈 #${seriesId} 삭제 완료. MMR 롤백 ${result.rollbackRows} 건.`,
		embeds: [],
		components: [],
	});
}
