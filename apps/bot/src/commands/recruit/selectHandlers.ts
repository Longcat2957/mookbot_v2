// 모집 메시지의 셀렉트 인터랙션 처리 — 라인 선호 + 운영자 멤버관리.

import { db } from "@mookbot/core";
import type { StringSelectMenuInteraction, UserSelectMenuInteraction } from "discord.js";
import { notify } from "../../utils/notify.js";
import { v2EditReply } from "../../utils/v2.js";
import { refreshRecruitMessage, renderComponents } from "./messageBuilder.js";
import type { RoleSlot } from "./types.js";

const {
	getRecruitment,
	addRecruitmentParticipant,
	removeRecruitmentParticipant,
	listRecruitmentParticipants,
	isRecruitmentParticipant,
	setRecruitmentRoles,
	upsertUser,
} = db;

export async function handleStringSelect(interaction: StringSelectMenuInteraction): Promise<void> {
	const [, action, idStr] = interaction.customId.split(":");
	if (action !== "roles") return;

	const id = Number(idStr);
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

export async function handleUserSelect(interaction: UserSelectMenuInteraction): Promise<void> {
	const [, action, idStr] = interaction.customId.split(":");
	if (action !== "adduser_select") return;

	const id = Number(idStr);
	const rec = await getRecruitment(id);
	if (!rec || rec.status !== "OPEN") {
		await interaction.reply({
			content: "이 모집은 더 이상 열려있지 않습니다.",
			ephemeral: true,
		});
		return;
	}
	if (interaction.user.id !== rec.created_by) {
		await interaction.reply({
			content: "운영자만 가능합니다.",
			ephemeral: true,
		});
		return;
	}

	await interaction.deferReply({ ephemeral: true });

	const targetSet = new Set<string>(interaction.values);
	const currentList = await listRecruitmentParticipants(id);
	const currentSet = new Set(currentList.map((p) => p.user_id));

	const toAddIds = [...targetSet].filter((uid) => !currentSet.has(uid));
	const toRemoveIds = [...currentSet].filter((uid) => !targetSet.has(uid));

	const newSize = currentSet.size - toRemoveIds.length + toAddIds.length;
	const overflow = Math.max(0, newSize - rec.target_count);
	const cappedAddIds = overflow > 0 ? toAddIds.slice(0, toAddIds.length - overflow) : toAddIds;
	const skipped = toAddIds.slice(cappedAddIds.length);

	const added: string[] = [];
	const removed: string[] = [];

	for (const userId of cappedAddIds) {
		let displayName = userId;
		if (interaction.guild) {
			const m = await interaction.guild.members.fetch(userId).catch(() => null);
			if (m) displayName = m.displayName;
		}
		await upsertUser(userId, displayName);
		await addRecruitmentParticipant({ recruitmentId: id, userId });
		await setRecruitmentRoles(id, userId, []);
		added.push(displayName);
	}

	for (const userId of toRemoveIds) {
		await removeRecruitmentParticipant(id, userId);
		removed.push(`<@${userId}>`);
	}

	// 모집 메시지 갱신
	let refreshError: string | null = null;
	if (added.length > 0 || removed.length > 0) {
		refreshError = await refreshRecruitMessage(interaction, id, rec.channel_id, rec.message_id);
		void notify(`recruitment:${id}`);
		void notify("dashboard");
	}

	const lines = [`### 멤버 관리 — 모집 #${id}`];
	if (added.length > 0) lines.push(`✅ 추가 (${added.length}): ${added.join(", ")}`);
	if (removed.length > 0) lines.push(`✗ 제거 (${removed.length}): ${removed.join(", ")}`);
	if (skipped.length > 0) lines.push(`⚠️ 정원 초과로 ${skipped.length}명 건너뜀`);
	if (added.length === 0 && removed.length === 0) lines.push("_변경 없음._");
	if (refreshError) {
		lines.push("", `⚠️ 모집 메시지 갱신 실패: \`${refreshError}\``);
	}

	await interaction.editReply({ content: lines.join("\n") });
}
