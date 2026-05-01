// 모집 메시지의 셀렉트 인터랙션 처리 — 라인 선호.

import { db } from "@mookbot/core";
import type { StringSelectMenuInteraction } from "discord.js";
import { notify } from "../../utils/notify.js";
import { v2EditReply } from "../../utils/v2.js";
import { renderComponents } from "./messageBuilder.js";
import type { RoleSlot } from "./types.js";

const {
	getRecruitment,
	addRecruitmentParticipant,
	listRecruitmentParticipants,
	isRecruitmentParticipant,
	setRecruitmentRoles,
	upsertUser,
} = db;

export async function handleStringSelect(interaction: StringSelectMenuInteraction): Promise<void> {
	const [, action, idStr] = interaction.customId.split(":");
	const id = Number(idStr);
	if (action === "roles") return await handleRoleSelect(interaction, id);
}

async function handleRoleSelect(
	interaction: StringSelectMenuInteraction,
	id: number,
): Promise<void> {
	const rec = await getRecruitment(id);
	if (!rec || rec.status !== "OPEN") {
		await interaction.reply({
			content: "이 모집은 더 이상 열려있지 않습니다.",
			ephemeral: true,
		});
		return;
	}

	const roles = interaction.values as RoleSlot[];
	await upsertUser(interaction.user.id, interaction.user.displayName);

	// 비참가자가 라인 선택 → 자동으로 참가 처리
	const already = await isRecruitmentParticipant(id, interaction.user.id);
	if (!already) {
		const participants = await listRecruitmentParticipants(id);
		if (participants.length >= rec.target_count) {
			await interaction.reply({ content: "정원이 가득 찼습니다.", ephemeral: true });
			return;
		}
		await addRecruitmentParticipant({ recruitmentId: id, userId: interaction.user.id });
	}

	await setRecruitmentRoles(id, interaction.user.id, roles);
	await interaction.update(v2EditReply(...(await renderComponents(id))));
	void notify(`recruitment:${id}`);
	void notify("dashboard");
}
