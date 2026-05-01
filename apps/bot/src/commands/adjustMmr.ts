import {
	type ChatInputCommandInteraction,
	EmbedBuilder,
	SlashCommandBuilder,
} from "discord.js";
import { db } from "@mookbot/core";
import { requireOperator } from "../utils/operator.js";

const { adjustLaneMmr, recordAudit, getCurrentSeason, upsertUser, ROLE_SLOTS } = db;

const ROLE_LABEL: Record<(typeof ROLE_SLOTS)[number], string> = {
	TOP: "탑",
	JUNGLE: "정글",
	MID: "미드",
	BOTTOM: "원딜",
	SUPPORT: "서폿",
};

export const data = new SlashCommandBuilder()
	.setName("mmr수정")
	.setDescription("[운영자] 특정 사용자 라인 MMR 수동 보정 (현재 시즌)")
	.addUserOption((o) => o.setName("user").setDescription("대상 사용자").setRequired(true))
	.addStringOption((o) =>
		o
			.setName("role")
			.setDescription("라인")
			.setRequired(true)
			.addChoices(...ROLE_SLOTS.map((r) => ({ name: ROLE_LABEL[r], value: r }))),
	)
	.addIntegerOption((o) =>
		o.setName("delta").setDescription("MMR 증감 (양수/음수)").setRequired(true),
	)
	.addStringOption((o) => o.setName("note").setDescription("사유 (audit 기록용)"));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!(await requireOperator(interaction))) return;

	const targetUser = interaction.options.getUser("user", true);
	const role = interaction.options.getString("role", true) as (typeof ROLE_SLOTS)[number];
	const delta = interaction.options.getInteger("delta", true);
	const note = interaction.options.getString("note");

	await interaction.deferReply({ ephemeral: true });

	const season = await getCurrentSeason();
	if (!season) {
		await interaction.editReply("❌ 현재 시즌이 없습니다. `/내전모집` 으로 시즌을 먼저 시작하세요.");
		return;
	}

	const member = interaction.guild
		? await interaction.guild.members.fetch(targetUser.id).catch(() => null)
		: null;
	const displayName = member?.displayName ?? targetUser.displayName ?? targetUser.username;
	await upsertUser(targetUser.id, displayName);

	const { before, after } = await adjustLaneMmr({
		userId: targetUser.id,
		seasonId: season.id,
		role,
		delta,
	});

	await recordAudit({
		operatorId: interaction.user.id,
		action: "mmr.adjust",
		targetType: "user",
		targetId: targetUser.id,
		payload: { seasonId: season.id, role, delta, before, after },
		...(note ? { note } : {}),
	});

	const embed = new EmbedBuilder()
		.setTitle("✅ MMR 수정 완료")
		.setColor(0x22a55a)
		.addFields(
			{ name: "대상", value: `<@${targetUser.id}> (${displayName})`, inline: false },
			{ name: "시즌", value: `#${season.id} ${season.name}`, inline: true },
			{ name: "라인", value: ROLE_LABEL[role], inline: true },
			{
				name: "MMR",
				value: `${before} → **${after}** (${delta > 0 ? "+" : ""}${delta})`,
				inline: false,
			},
		);
	if (note) embed.addFields({ name: "사유", value: note });

	await interaction.editReply({ embeds: [embed] });
}
