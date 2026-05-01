// /모집인원추가 — 운영자가 모집 풀에 멤버를 한 명 추가.

import { db } from "@mookbot/core";
import {
	ApplicationIntegrationType,
	type ChatInputCommandInteraction,
	InteractionContextType,
	SlashCommandBuilder,
} from "discord.js";
import { notify } from "../utils/notify.js";
import { refreshRecruitMessage } from "./recruit/messageBuilder.js";

const {
	getRecruitment,
	addRecruitmentParticipant,
	listRecruitmentParticipants,
	isRecruitmentParticipant,
	setRecruitmentRoles,
	upsertUser,
} = db;

export const data = new SlashCommandBuilder()
	.setName("모집인원추가")
	.setDescription("모집 풀에 멤버를 한 명 추가합니다 (모집 운영자 전용).")
	.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
	.setContexts(InteractionContextType.Guild)
	.addIntegerOption((o) =>
		o.setName("모집").setDescription("모집 ID").setRequired(true).setMinValue(1),
	)
	.addUserOption((o) =>
		o.setName("멤버").setDescription("추가할 디스코드 멤버").setRequired(true),
	);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.inGuild() || !interaction.guild) {
		await interaction.reply({ content: "서버에서만 사용 가능", ephemeral: true });
		return;
	}
	const id = interaction.options.getInteger("모집", true);
	const targetUser = interaction.options.getUser("멤버", true);

	const rec = await getRecruitment(id);
	if (!rec) {
		await interaction.reply({ content: `모집 #${id} 없음`, ephemeral: true });
		return;
	}
	if (rec.created_by !== interaction.user.id) {
		await interaction.reply({
			content: "모집을 만든 운영자만 가능합니다.",
			ephemeral: true,
		});
		return;
	}
	if (rec.status !== "OPEN" && rec.status !== "CLOSED") {
		await interaction.reply({
			content: `모집 상태가 ${rec.status} 라 추가 불가.`,
			ephemeral: true,
		});
		return;
	}
	if (targetUser.bot) {
		await interaction.reply({ content: "봇은 추가할 수 없습니다.", ephemeral: true });
		return;
	}

	await interaction.deferReply({ ephemeral: true });

	if (await isRecruitmentParticipant(id, targetUser.id)) {
		await interaction.editReply({
			content: `이미 풀에 있는 멤버: <@${targetUser.id}>`,
		});
		return;
	}

	const participants = await listRecruitmentParticipants(id);
	if (participants.length >= rec.target_count) {
		await interaction.editReply({
			content: `정원 가득 (${participants.length}/${rec.target_count}). 다른 멤버를 빼야 추가 가능.`,
		});
		return;
	}

	const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
	const displayName =
		member?.displayName ?? targetUser.displayName ?? targetUser.username ?? targetUser.id;

	await upsertUser(targetUser.id, displayName);
	await addRecruitmentParticipant({ recruitmentId: id, userId: targetUser.id });
	await setRecruitmentRoles(id, targetUser.id, []);

	const refreshError = await refreshRecruitMessage(
		interaction,
		id,
		rec.channel_id,
		rec.message_id,
	);
	void notify(`recruitment:${id}`);
	void notify("dashboard");

	const lines = [
		`### ✅ 추가 — 모집 #${id}`,
		`**${displayName}** (<@${targetUser.id}>) → 풀 ${participants.length + 1}/${rec.target_count}`,
	];
	if (refreshError) {
		lines.push("", `⚠️ 모집 메시지 갱신 실패: \`${refreshError}\``);
	}
	await interaction.editReply({ content: lines.join("\n") });
}
