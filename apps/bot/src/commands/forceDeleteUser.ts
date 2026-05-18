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

const { inspectUserForDelete, softDeleteUser, recordAudit } = db;

export const data = new SlashCommandBuilder()
	.setName("유저강제삭제")
	.setDescription("[운영자] Mookbot 계정 소프트 삭제 (FK 보존, 모든 lookup 에서 제외)")
	.addUserOption((o) =>
		o.setName("user").setDescription("삭제할 Discord 유저").setRequired(true),
	);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!(await requireOperator(interaction))) return;

	const target = interaction.options.getUser("user", true);

	await interaction.deferReply({ ephemeral: true });

	const summary = await inspectUserForDelete(target.id);
	if (!summary.exists) {
		await interaction.editReply(`❌ <@${target.id}> 는 등록된 사용자가 아닙니다.`);
		return;
	}
	if (summary.alreadyDeleted) {
		await interaction.editReply(
			`ℹ️ <@${target.id}> (${summary.displayName ?? "?"}) 는 이미 소프트 삭제된 상태입니다.`,
		);
		return;
	}

	const embed = new EmbedBuilder()
		.setTitle(`⚠️ 유저 소프트 삭제 미리보기`)
		.setColor(0xe8b339)
		.addFields(
			{ name: "대상", value: `<@${target.id}>`, inline: true },
			{ name: "표시명", value: summary.displayName ?? "?", inline: true },
			{ name: "Riot 연결", value: String(summary.riotAccounts), inline: true },
			{ name: "시리즈 참가", value: String(summary.seriesParticipations), inline: true },
			{ name: "게임 기록", value: String(summary.gameStats), inline: true },
			{ name: "경매 모집 참가", value: String(summary.auctionParticipations), inline: true },
		)
		.setDescription(
			[
				"**소프트 삭제** — `deleted_at` 만 설정. FK / 기록 / 통계는 모두 보존.",
				"모든 user lookup 래퍼가 자동 필터하므로 화면/검색/모집에서 즉시 사라짐.",
				"",
				"⚠️ 재등록 차단: `/등록` 이 ON CONFLICT 로 display_name 만 갱신하므로 deleted_at 유지됨.",
				"복구는 `db.restoreUser(discordId)` 직접 호출 (별도 명령 추후).",
			].join("\n"),
		);

	const confirmId = `admin:confirm:user_force_delete:${target.id}`;
	const cancelId = `admin:cancel:user_force_delete:${target.id}`;
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setCustomId(confirmId).setLabel("확정 삭제").setStyle(ButtonStyle.Danger),
		new ButtonBuilder().setCustomId(cancelId).setLabel("취소").setStyle(ButtonStyle.Secondary),
	);

	await interaction.editReply({ embeds: [embed], components: [row] });
}

export async function handleButton(interaction: ButtonInteraction): Promise<void> {
	const parts = interaction.customId.split(":");
	if (parts[2] !== "user_force_delete") return;

	if (!(await requireOperator(interaction))) return;

	if (parts[1] === "cancel") {
		await interaction.update({ content: "취소되었습니다.", embeds: [], components: [] });
		return;
	}

	const targetId = parts[3];
	if (!targetId) {
		await interaction.update({ content: "❌ targetId 누락", embeds: [], components: [] });
		return;
	}

	await interaction.deferUpdate();
	const changes = await softDeleteUser(targetId);

	if (changes === 0) {
		await interaction.editReply({
			content: `ℹ️ <@${targetId}> 는 존재하지 않거나 이미 삭제됨.`,
			embeds: [],
			components: [],
		});
		return;
	}

	await recordAudit({
		operatorId: interaction.user.id,
		action: "user.soft_delete",
		targetType: "user",
		targetId,
		payload: { changes },
	});

	await interaction.editReply({
		content: `✅ <@${targetId}> 소프트 삭제 완료. FK / 기록 / MMR 보존.`,
		embeds: [],
		components: [],
	});
}
