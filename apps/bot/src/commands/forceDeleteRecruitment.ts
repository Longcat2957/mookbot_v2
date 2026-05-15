// /모집강제삭제 — 운영자가 임의 모집(OPEN/CLOSED/CANCELLED) 을 ID 로 즉시 물리 삭제.
// CONVERTED 모집은 차단 → /내전강제삭제 사용 안내.

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

const { getRecruitment, listRecruitmentParticipants, deleteRecruitment, recordAudit, getSeries } =
	db;

export const data = new SlashCommandBuilder()
	.setName("내전모집삭제")
	.setDescription("[운영자] 처리대기/엔트리대기 모집을 ID 로 물리 삭제")
	.addIntegerOption((o) =>
		o.setName("모집").setDescription("삭제할 모집 ID").setRequired(true).setMinValue(1),
	);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!(await requireOperator(interaction))) return;

	const recruitmentId = interaction.options.getInteger("모집", true);
	await interaction.deferReply({ ephemeral: true });

	const rec = await getRecruitment(recruitmentId);
	if (!rec) {
		await interaction.editReply(`❌ 모집 #${recruitmentId} 를 찾을 수 없습니다.`);
		return;
	}
	if (rec.status === "CONVERTED" && rec.converted_series_id) {
		await interaction.editReply(
			`❌ 이미 시리즈 #${rec.converted_series_id} 로 변환된 모집입니다. \`/내전강제삭제 series_id:${rec.converted_series_id} rollback_mmr:true\` 사용.`,
		);
		return;
	}
	// 같은 id 의 active series 가 있으면 차단 — status 가 CONVERTED 가 아닌
	// edge case (createSeries 후 setRecruitmentStatus 미적용 등) 도 caught.
	const linkedSeries = await getSeries(recruitmentId);
	if (linkedSeries && linkedSeries.status === "IN_PROGRESS") {
		await interaction.editReply(
			`❌ 시리즈 #${recruitmentId} 가 IN_PROGRESS 상태입니다. \`/내전강제삭제 series_id:${recruitmentId} rollback_mmr:true\` 로 먼저 정리하세요.`,
		);
		return;
	}

	const participants = await listRecruitmentParticipants(recruitmentId);
	const teamSize = rec.target_count / 2;

	const embed = new EmbedBuilder()
		.setTitle(`⚠️ 모집 #${recruitmentId} 강제 삭제 미리보기`)
		.setColor(0xe8b339)
		.addFields(
			{ name: "상태", value: rec.status, inline: true },
			{ name: "정원", value: `${teamSize}v${teamSize} (${rec.target_count})`, inline: true },
			{ name: "참가자", value: `${participants.length}명`, inline: true },
			{
				name: "모집 메시지",
				value:
					rec.channel_id && rec.message_id
						? `채널 \`${rec.channel_id}\` / 메시지 \`${rec.message_id}\` (best-effort 삭제 시도)`
						: "추적 정보 없음",
				inline: false,
			},
		)
		.setDescription(
			"recruitment row + participants + role prefs (CASCADE) 가 즉시 물리 삭제됩니다. 되돌릴 수 없습니다.",
		);

	const confirmId = `admin:confirm:recruitment_force_delete:${recruitmentId}`;
	const cancelId = `admin:cancel:recruitment_force_delete:${recruitmentId}`;
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setCustomId(confirmId).setLabel("확정 삭제").setStyle(ButtonStyle.Danger),
		new ButtonBuilder().setCustomId(cancelId).setLabel("취소").setStyle(ButtonStyle.Secondary),
	);

	await interaction.editReply({ embeds: [embed], components: [row] });
}

export async function handleButton(interaction: ButtonInteraction): Promise<void> {
	const parts = interaction.customId.split(":");
	if (parts[2] !== "recruitment_force_delete") return;

	if (!(await requireOperator(interaction))) return;

	if (parts[1] === "cancel") {
		await interaction.update({ content: "취소되었습니다.", embeds: [], components: [] });
		return;
	}

	const recruitmentId = Number(parts[3]);
	await interaction.deferUpdate();

	const rec = await getRecruitment(recruitmentId);
	if (!rec) {
		await interaction.editReply({
			content: `❌ 모집 #${recruitmentId} 가 이미 삭제되었거나 존재하지 않습니다.`,
			embeds: [],
			components: [],
		});
		return;
	}
	if (rec.status === "CONVERTED" && rec.converted_series_id) {
		await interaction.editReply({
			content: `❌ 시리즈 #${rec.converted_series_id} 로 변환된 모집입니다. \`/내전강제삭제\` 사용.`,
			embeds: [],
			components: [],
		});
		return;
	}
	const linkedSeries = await getSeries(recruitmentId);
	if (linkedSeries && linkedSeries.status === "IN_PROGRESS") {
		await interaction.editReply({
			content: `❌ 시리즈 #${recruitmentId} 가 IN_PROGRESS — \`/내전강제삭제 series_id:${recruitmentId} rollback_mmr:true\` 로 먼저 정리.`,
			embeds: [],
			components: [],
		});
		return;
	}

	const participants = await listRecruitmentParticipants(recruitmentId);

	await deleteRecruitment(recruitmentId);

	await recordAudit({
		operatorId: interaction.user.id,
		action: "recruitment.force_delete",
		targetType: "recruitment",
		targetId: String(recruitmentId),
		payload: {
			originalStatus: rec.status,
			targetCount: rec.target_count,
			participantsAtDelete: participants.length,
			channelId: rec.channel_id,
			messageId: rec.message_id,
		},
	});

	// 모집 메시지 best-effort 삭제 — 권한/접근 실패는 silent skip
	let messageDeleted = false;
	if (rec.channel_id && rec.message_id) {
		try {
			const ch = await interaction.client.channels.fetch(rec.channel_id);
			if (ch?.isTextBased() && "messages" in ch) {
				const msg = await ch.messages.fetch(rec.message_id);
				await msg.delete();
				messageDeleted = true;
			}
		} catch {
			// 무시 — DB 정리만 보장
		}
	}

	void notify("dashboard");
	void notify(`recruitment:${recruitmentId}`);

	await interaction.editReply({
		content: [
			`✅ 모집 #${recruitmentId} 삭제 완료 (참가자 ${participants.length}명 cascade).`,
			messageDeleted ? "모집 메시지도 삭제됨." : "모집 메시지: 삭제 못 함 (권한/없음).",
		].join("\n"),
		embeds: [],
		components: [],
	});
}
