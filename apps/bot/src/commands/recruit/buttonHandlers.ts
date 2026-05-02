// 모집 메시지의 버튼 인터랙션 처리 — 참여/취소/엔트리 진입.

import { db } from "@mookbot/core";
import type { ButtonInteraction } from "discord.js";
import { resolveGuildDisplayName } from "../../utils/displayName.js";
import { notify } from "../../utils/notify.js";
import { v2EditReply } from "../../utils/v2.js";
import { renderComponents } from "./messageBuilder.js";

const {
	getRecruitment,
	setRecruitmentStatus,
	addRecruitmentParticipant,
	removeRecruitmentParticipant,
	listRecruitmentParticipants,
	isRecruitmentParticipant,
	upsertUser,
} = db;

export async function handleButton(interaction: ButtonInteraction): Promise<void> {
	const [, action, idStr] = interaction.customId.split(":");
	const id = Number(idStr);
	if (!id) {
		await interaction.reply({ content: "잘못된 모집 ID", ephemeral: true });
		return;
	}
	const rec = await getRecruitment(id);
	if (!rec) {
		await interaction.reply({ content: "모집을 찾을 수 없습니다.", ephemeral: true });
		return;
	}
	const isOpen = rec.status === "OPEN";
	const isClosed = rec.status === "CLOSED";

	// 참가자 액션은 OPEN 일 때만
	const participantActions = new Set<string | undefined>(["join", "leave"]);
	if (participantActions.has(action) && !isOpen) {
		await interaction.reply({ content: `모집이 ${rec.status} 상태입니다.`, ephemeral: true });
		return;
	}
	// 운영자 액션 (cancel) 은 OPEN/CLOSED 모두 허용
	if (!isOpen && !isClosed) {
		await interaction.reply({ content: `모집이 ${rec.status} 상태입니다.`, ephemeral: true });
		return;
	}

	// upsertUser 는 각 액션 핸들러 내부에서 — 항상 GuildMember.displayName 우선.
	switch (action) {
		case "join":
			return await handleJoin(interaction, id, rec.target_count);
		case "leave":
			return await handleLeave(interaction, id);
		case "cancel":
			return await handleCancel(interaction, id, rec.created_by);
		case "next":
			if (!isOpen) {
				await interaction.reply({
					content: "이미 엔트리 수정 단계로 진입한 모집입니다.",
					ephemeral: true,
				});
				return;
			}
			return await handleNext(interaction, id, rec.created_by);
		default:
			await interaction.reply({ content: `알 수 없는 액션: ${action}`, ephemeral: true });
	}
}

async function handleJoin(
	interaction: ButtonInteraction,
	id: number,
	target: number,
): Promise<void> {
	const already = await isRecruitmentParticipant(id, interaction.user.id);
	if (already) {
		await interaction.reply({ content: "이미 참석 등록되어 있습니다.", ephemeral: true });
		return;
	}
	const participants = await listRecruitmentParticipants(id);
	if (participants.length >= target) {
		await interaction.reply({ content: "정원이 가득 찼습니다.", ephemeral: true });
		return;
	}
	// 디스코드 3초 ack 윈도우 회피 — 무거운 D1 쿼리 전 deferUpdate 로 먼저 응답
	await interaction.deferUpdate();
	// GuildMember.displayName 우선 — interaction.user.displayName (글로벌) 직접 사용 금지
	const memberName = await resolveGuildDisplayName(interaction.guild, interaction.user);
	await upsertUser(interaction.user.id, memberName);
	await addRecruitmentParticipant({ recruitmentId: id, userId: interaction.user.id });
	const components = await renderComponents(id);
	await interaction.editReply(v2EditReply(...components));
	void notify(`recruitment:${id}`);
	void notify("dashboard");
}

async function handleLeave(interaction: ButtonInteraction, id: number): Promise<void> {
	const already = await isRecruitmentParticipant(id, interaction.user.id);
	if (!already) {
		await interaction.reply({ content: "참석하지 않은 상태입니다.", ephemeral: true });
		return;
	}
	await interaction.deferUpdate();
	await removeRecruitmentParticipant(id, interaction.user.id);
	const components = await renderComponents(id);
	await interaction.editReply(v2EditReply(...components));
	void notify(`recruitment:${id}`);
	void notify("dashboard");
}

async function handleCancel(
	interaction: ButtonInteraction,
	id: number,
	createdBy: string,
): Promise<void> {
	if (interaction.user.id !== createdBy) {
		await interaction.reply({
			content: "모집을 취소할 수 있는 건 모집을 만든 운영자뿐입니다.",
			ephemeral: true,
		});
		return;
	}
	await interaction.deferUpdate();
	await setRecruitmentStatus(id, "CANCELLED");
	const components = await renderComponents(id);
	await interaction.editReply(v2EditReply(...components));
	void notify(`recruitment:${id}`);
	void notify("dashboard");
}

async function handleNext(
	interaction: ButtonInteraction,
	id: number,
	createdBy: string,
): Promise<void> {
	if (interaction.user.id !== createdBy) {
		await interaction.reply({
			content: "엔트리 수정 시작은 모집을 만든 운영자만 가능합니다.",
			ephemeral: true,
		});
		return;
	}
	const participants = await listRecruitmentParticipants(id);
	const rec = await getRecruitment(id);
	if (!rec) return;
	if (participants.length < rec.target_count) {
		await interaction.reply({
			content: `정원 미달 (${participants.length}/${rec.target_count}). \`/모집인원추가 모집:${id} 멤버:@xxx\` 로 채우세요.`,
			ephemeral: true,
		});
		return;
	}
	// 모집 → CLOSED 전이. Activity 가 CLOSED 모집 리스트를 보여주고
	// 운영자가 클릭 시 엔트리 수정 화면으로 이동.
	// deferUpdate 로 3초 ack 회피 — 그 다음 D1 작업 + 메시지 갱신.
	await interaction.deferUpdate();
	await setRecruitmentStatus(id, "CLOSED");
	const components = await renderComponents(id);
	await interaction.editReply(v2EditReply(...components));
	void notify(`recruitment:${id}`);
	void notify("dashboard");
	await interaction.followUp({
		content: [
			`### ▶ 엔트리 수정 시작 — 모집 #${id} 마감`,
			"보이스 채널에서 **Activity** 를 시작한 뒤 **mookbot** 을 선택하세요.",
			"Activity 첫 화면에 마감된 모집 목록이 표시되며, 클릭하면 엔트리 수정 화면이 열립니다.",
		].join("\n"),
		ephemeral: true,
	});
}
