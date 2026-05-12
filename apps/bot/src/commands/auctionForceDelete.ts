// /경매내전강제삭제 — 운영자가 경매 모집 또는 토너먼트를 강제 삭제 (응급).
// CONVERTED 모집은 토너먼트 cancel + 모집 row 삭제로 cascade.

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
import { notify } from "../utils/notify.js";
import { requireOperator } from "../utils/operator.js";

const {
	getAuctionRecruitment,
	listAuctionRecruitmentParticipants,
	deleteAuctionRecruitment,
	getAuctionTournament,
	softDeleteAuctionTournament,
	recordAudit,
} = db;

export const data = new SlashCommandBuilder()
	.setName("경매내전강제삭제")
	.setDescription("[운영자] 경매 모집/토너먼트를 강제 삭제 (응급)")
	.addIntegerOption((o) =>
		o.setName("모집").setDescription("삭제할 경매 모집 ID").setRequired(true).setMinValue(1),
	);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!(await requireOperator(interaction))) return;

	const recruitmentId = interaction.options.getInteger("모집", true);
	await interaction.deferReply({ ephemeral: true });

	const rec = await getAuctionRecruitment(recruitmentId);
	if (!rec) {
		await interaction.editReply(`❌ 경매 모집 #${recruitmentId} 를 찾을 수 없습니다.`);
		return;
	}

	const participants = await listAuctionRecruitmentParticipants(recruitmentId);
	const tournament = rec.converted_tournament_id
		? await getAuctionTournament(rec.converted_tournament_id)
		: null;

	const embed = new EmbedBuilder()
		.setTitle(`⚠️ 경매 모집 #${recruitmentId} 강제 삭제 미리보기`)
		.setColor(0xe8b339)
		.addFields(
			{ name: "상태", value: rec.status, inline: true },
			{ name: "정원", value: `${rec.target_count}`, inline: true },
			{ name: "참가자", value: `${participants.length}명`, inline: true },
			{
				name: "변환된 토너먼트",
				value: tournament
					? `#${tournament.id} (status=${tournament.status}) → soft-delete`
					: rec.converted_tournament_id
						? `#${rec.converted_tournament_id} (이미 정리됨)`
						: "없음",
				inline: false,
			},
			{
				name: "모집 메시지",
				value:
					rec.channel_id && rec.message_id
						? `채널 \`${rec.channel_id}\` / 메시지 \`${rec.message_id}\``
						: "추적 정보 없음",
				inline: false,
			},
		)
		.setDescription(
			"auction_recruitment + participants (CASCADE) 즉시 물리 삭제. 변환된 토너먼트가 있으면 soft-delete. 되돌릴 수 없습니다.",
		);

	const confirmId = `admin:confirm:auction_force_delete:${recruitmentId}`;
	const cancelId = `admin:cancel:auction_force_delete:${recruitmentId}`;
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setCustomId(confirmId).setLabel("확정 삭제").setStyle(ButtonStyle.Danger),
		new ButtonBuilder().setCustomId(cancelId).setLabel("취소").setStyle(ButtonStyle.Secondary),
	);

	await interaction.editReply({ embeds: [embed], components: [row] });
}

export async function handleButton(interaction: ButtonInteraction): Promise<void> {
	const parts = interaction.customId.split(":");
	if (parts[2] !== "auction_force_delete") return;

	if (!(await requireOperator(interaction))) return;

	if (parts[1] === "cancel") {
		await interaction.update({ content: "취소되었습니다.", embeds: [], components: [] });
		return;
	}

	const recruitmentId = Number(parts[3]);
	await interaction.deferUpdate();

	const rec = await getAuctionRecruitment(recruitmentId);
	if (!rec) {
		await interaction.editReply({
			content: `❌ 경매 모집 #${recruitmentId} 가 이미 삭제됐거나 없음.`,
			embeds: [],
			components: [],
		});
		return;
	}

	const participants = await listAuctionRecruitmentParticipants(recruitmentId);

	// 변환된 토너먼트가 있으면 soft-delete
	if (rec.converted_tournament_id) {
		await softDeleteAuctionTournament(rec.converted_tournament_id);
	}
	await deleteAuctionRecruitment(recruitmentId);

	await recordAudit({
		operatorId: interaction.user.id,
		action: "auction-recruitment.force_delete",
		targetType: "auction-recruitment",
		targetId: String(recruitmentId),
		payload: {
			originalStatus: rec.status,
			targetCount: rec.target_count,
			participantsAtDelete: participants.length,
			tournamentId: rec.converted_tournament_id,
			channelId: rec.channel_id,
			messageId: rec.message_id,
		},
	});

	// 모집 메시지 best-effort 삭제
	let messageDeleted = false;
	if (rec.channel_id && rec.message_id) {
		try {
			const ch = await interaction.client.channels.fetch(rec.channel_id);
			if (ch && ch.isTextBased() && "messages" in ch) {
				const msg = await ch.messages.fetch(rec.message_id);
				await msg.delete();
				messageDeleted = true;
			}
		} catch {}
	}

	void notify("auction-dashboard");
	void notify(`auction-recruitment:${recruitmentId}`);
	if (rec.converted_tournament_id) {
		void notify(`auction-tournament:${rec.converted_tournament_id}`);
	}

	await interaction.editReply({
		content: [
			`✅ 경매 모집 #${recruitmentId} 삭제 (참가자 ${participants.length}명 cascade).`,
			rec.converted_tournament_id ? `토너먼트 #${rec.converted_tournament_id} soft-delete.` : "",
			messageDeleted ? "모집 메시지도 삭제됨." : "모집 메시지: 삭제 못 함 (권한/없음).",
		]
			.filter(Boolean)
			.join("\n"),
		embeds: [],
		components: [],
	});
}
