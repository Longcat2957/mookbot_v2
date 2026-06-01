// /내전모집복구 — CANCELLED 일반 모집을 다시 OPEN 상태로 복구.

import { db } from "@mookbot/core";
import {
	ApplicationIntegrationType,
	type ChatInputCommandInteraction,
	InteractionContextType,
	SlashCommandBuilder,
} from "discord.js";
import { notify } from "../utils/notify.js";
import { requireOperator } from "../utils/operator.js";
import { refreshRecruitMessage } from "./recruit/messageBuilder.js";

const { getRecruitment, listRecruitmentParticipants, recordAudit, setRecruitmentStatus } = db;

export const data = new SlashCommandBuilder()
	.setName("내전모집복구")
	.setDescription("[운영자] 취소된 일반 내전 모집을 다시 모집 중으로 복구")
	.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
	.setContexts(InteractionContextType.Guild)
	.addIntegerOption((o) =>
		o.setName("모집").setDescription("복구할 모집 ID").setRequired(true).setMinValue(1),
	);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.inGuild()) {
		await interaction.reply({ content: "서버에서만 사용 가능", ephemeral: true });
		return;
	}
	if (!(await requireOperator(interaction))) return;

	const id = interaction.options.getInteger("모집", true);
	await interaction.deferReply({ ephemeral: true });

	const rec = await getRecruitment(id);
	if (!rec) {
		await interaction.editReply(`모집 #${id} 없음`);
		return;
	}
	if (rec.status !== "CANCELLED") {
		await interaction.editReply(`모집 #${id} 상태가 ${rec.status} 라 복구 대상이 아닙니다.`);
		return;
	}
	if (rec.converted_series_id !== null) {
		await interaction.editReply(
			`모집 #${id} 는 시리즈 #${rec.converted_series_id} 와 연결되어 있어 복구할 수 없습니다.`,
		);
		return;
	}

	const participants = await listRecruitmentParticipants(id);
	await setRecruitmentStatus(id, "OPEN");
	await recordAudit({
		operatorId: interaction.user.id,
		action: "recruitment.restored",
		targetType: "recruitment",
		targetId: String(id),
		payload: { participantCount: participants.length, targetCount: rec.target_count },
	});

	const refreshError = await refreshRecruitMessage(interaction, id, rec.channel_id, rec.message_id);
	void notify(`recruitment:${id}`);
	void notify("dashboard");

	const lines = [
		`### ✅ 모집 #${id} 복구 완료`,
		`상태: CANCELLED → **OPEN**`,
		`정원: ${participants.length}/${rec.target_count}`,
	];
	if (refreshError) lines.push("", `⚠️ 모집 메시지 갱신 실패: \`${refreshError}\``);
	await interaction.editReply({ content: lines.join("\n") });
}
