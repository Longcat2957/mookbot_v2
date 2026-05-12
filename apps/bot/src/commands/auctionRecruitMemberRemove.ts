// /경매내전모집인원삭제 — 운영자가 경매 모집에서 멤버 강제 제거.

import { db } from "@mookbot/core";
import {
	ApplicationIntegrationType,
	type ChatInputCommandInteraction,
	InteractionContextType,
	SlashCommandBuilder,
} from "discord.js";
import { notify } from "../utils/notify.js";
import { refreshAuctionRecruitMessage } from "./auctionRecruit/messageBuilder.js";

const {
	getAuctionRecruitment,
	removeAuctionRecruitmentParticipant,
	listAuctionRecruitmentParticipants,
	isAuctionRecruitmentParticipant,
} = db;

export const data = new SlashCommandBuilder()
	.setName("경매내전모집인원삭제")
	.setDescription("경매 모집에서 멤버를 제거합니다 (모집 운영자 전용).")
	.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
	.setContexts(InteractionContextType.Guild)
	.addIntegerOption((o) =>
		o.setName("모집").setDescription("경매 모집 ID").setRequired(true).setMinValue(1),
	)
	.addUserOption((o) => o.setName("멤버").setDescription("제거할 디스코드 멤버").setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.inGuild() || !interaction.guild) {
		await interaction.reply({ content: "서버에서만 사용 가능", ephemeral: true });
		return;
	}
	const id = interaction.options.getInteger("모집", true);
	const targetUser = interaction.options.getUser("멤버", true);

	const rec = await getAuctionRecruitment(id);
	if (!rec) {
		await interaction.reply({ content: `경매 모집 #${id} 없음`, ephemeral: true });
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
			content: `모집 상태가 ${rec.status} 라 제거 불가.`,
			ephemeral: true,
		});
		return;
	}

	await interaction.deferReply({ ephemeral: true });

	if (!(await isAuctionRecruitmentParticipant(id, targetUser.id))) {
		await interaction.editReply({
			content: `풀에 없는 멤버: <@${targetUser.id}>`,
		});
		return;
	}

	await removeAuctionRecruitmentParticipant(id, targetUser.id);
	const participants = await listAuctionRecruitmentParticipants(id);

	const refreshError = await refreshAuctionRecruitMessage(
		interaction,
		id,
		rec.channel_id,
		rec.message_id,
	);
	void notify(`auction-recruitment:${id}`);
	void notify("auction-dashboard");

	const lines = [
		`### ✅ 제거 — 경매 모집 #${id}`,
		`<@${targetUser.id}> → 풀 ${participants.length}/${rec.target_count}`,
	];
	if (refreshError) {
		lines.push("", `⚠️ 모집 메시지 갱신 실패: \`${refreshError}\``);
	}
	await interaction.editReply({ content: lines.join("\n") });
}
