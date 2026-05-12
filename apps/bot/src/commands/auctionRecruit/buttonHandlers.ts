// 경매 모집 메시지의 버튼 인터랙션 처리 — 참여/취소/경매시작.

import { db } from "@mookbot/core";
import type { ButtonInteraction } from "discord.js";
import { resolveGuildDisplayName } from "../../utils/displayName.js";
import { notify as wsNotify } from "../../utils/notify.js";
import { v2EditReply } from "../../utils/v2.js";
import { renderComponents } from "./messageBuilder.js";

const {
	getAuctionRecruitment,
	setAuctionRecruitmentStatus,
	addAuctionRecruitmentParticipant,
	removeAuctionRecruitmentParticipant,
	listAuctionRecruitmentParticipants,
	isAuctionRecruitmentParticipant,
	upsertUser,
	recordAudit,
} = db;

/**
 * 사용자 알림 (ephemeral) — defer 후/전 어느 상태든 안전하게 전달.
 * Discord 10062 (Unknown interaction) 회피 — 모든 reply 를 try/catch.
 */
async function notify(interaction: ButtonInteraction, content: string): Promise<void> {
	try {
		if (interaction.deferred || interaction.replied) {
			await interaction.followUp({ content, ephemeral: true });
		} else {
			await interaction.reply({ content, ephemeral: true });
		}
	} catch {}
}

export async function handleButton(interaction: ButtonInteraction): Promise<void> {
	const [, action, idStr] = interaction.customId.split(":");
	const id = Number(idStr);
	if (!id) {
		await notify(interaction, "잘못된 모집 ID");
		return;
	}

	// 3초 ack 윈도우 확보 — D1 fetch 전 즉시 deferUpdate
	try {
		await interaction.deferUpdate();
	} catch {}

	const rec = await getAuctionRecruitment(id);
	if (!rec) {
		await notify(interaction, "경매 모집을 찾을 수 없습니다.");
		return;
	}
	const isOpen = rec.status === "OPEN";
	const isClosed = rec.status === "CLOSED";

	const participantActions = new Set<string | undefined>(["join", "leave"]);
	if (participantActions.has(action) && !isOpen) {
		await notify(interaction, `경매 모집이 ${rec.status} 상태입니다.`);
		return;
	}
	if (!isOpen && !isClosed) {
		await notify(interaction, `경매 모집이 ${rec.status} 상태입니다.`);
		return;
	}

	switch (action) {
		case "join":
			return await handleJoin(interaction, id, rec.target_count);
		case "leave":
			return await handleLeave(interaction, id);
		case "cancel":
			return await handleCancel(interaction, id, rec.created_by);
		case "next":
			if (!isOpen) {
				await notify(interaction, "이미 경매 단계로 진입한 모집입니다.");
				return;
			}
			return await handleNext(interaction, id, rec.created_by);
		default:
			await notify(interaction, `알 수 없는 액션: ${action}`);
	}
}

// 각 핸들러는 handleButton 에서 이미 deferUpdate 완료 가정.

async function handleJoin(
	interaction: ButtonInteraction,
	id: number,
	target: number,
): Promise<void> {
	const already = await isAuctionRecruitmentParticipant(id, interaction.user.id);
	if (already) {
		await notify(interaction, "이미 참석 등록되어 있습니다.");
		return;
	}
	const participants = await listAuctionRecruitmentParticipants(id);
	if (participants.length >= target) {
		await notify(interaction, "정원이 가득 찼습니다.");
		return;
	}
	const memberName = await resolveGuildDisplayName(interaction.guild, interaction.user);
	await upsertUser(interaction.user.id, memberName);
	await addAuctionRecruitmentParticipant({ recruitmentId: id, userId: interaction.user.id });
	const components = await renderComponents(id);
	await interaction.editReply(v2EditReply(...components));
	void wsNotify(`auction-recruitment:${id}`);
	void wsNotify("auction-dashboard");
}

async function handleLeave(interaction: ButtonInteraction, id: number): Promise<void> {
	const already = await isAuctionRecruitmentParticipant(id, interaction.user.id);
	if (!already) {
		await notify(interaction, "참석하지 않은 상태입니다.");
		return;
	}
	await removeAuctionRecruitmentParticipant(id, interaction.user.id);
	const components = await renderComponents(id);
	await interaction.editReply(v2EditReply(...components));
	void wsNotify(`auction-recruitment:${id}`);
	void wsNotify("auction-dashboard");
}

async function handleCancel(
	interaction: ButtonInteraction,
	id: number,
	createdBy: string,
): Promise<void> {
	if (interaction.user.id !== createdBy) {
		await notify(interaction, "모집을 취소할 수 있는 건 모집을 만든 운영자뿐입니다.");
		return;
	}
	await setAuctionRecruitmentStatus(id, "CANCELLED");
	await recordAudit({
		operatorId: interaction.user.id,
		action: "auction-recruitment.cancelled",
		targetType: "auction-recruitment",
		targetId: String(id),
	});
	const components = await renderComponents(id);
	await interaction.editReply(v2EditReply(...components));
	void wsNotify(`auction-recruitment:${id}`);
	void wsNotify("auction-dashboard");
}

async function handleNext(
	interaction: ButtonInteraction,
	id: number,
	createdBy: string,
): Promise<void> {
	if (interaction.user.id !== createdBy) {
		await notify(interaction, "경매 시작은 모집을 만든 운영자만 가능합니다.");
		return;
	}
	const participants = await listAuctionRecruitmentParticipants(id);
	const rec = await getAuctionRecruitment(id);
	if (!rec) return;
	if (participants.length < rec.target_count) {
		await notify(
			interaction,
			`정원 미달 (${participants.length}/${rec.target_count}). \`/경매내전모집인원추가 모집:${id} 멤버:@xxx\` 로 채우세요.`,
		);
		return;
	}
	// status 만 CLOSED 로 — 실제 토너먼트 INSERT 는 Activity 첫 진입 시 api 가 처리
	await setAuctionRecruitmentStatus(id, "CLOSED");
	await recordAudit({
		operatorId: interaction.user.id,
		action: "auction-recruitment.closed",
		targetType: "auction-recruitment",
		targetId: String(id),
		payload: { participantCount: participants.length },
	});
	const components = await renderComponents(id);
	await interaction.editReply(v2EditReply(...components));
	void wsNotify(`auction-recruitment:${id}`);
	void wsNotify("auction-dashboard");
	try {
		await interaction.followUp({
			content: [
				`### ▶ 경매 시작 — 경매 모집 #${id} 마감`,
				"보이스 채널에서 **Activity** 를 시작한 뒤 **monkey** 를 선택하세요.",
				"Activity 의 경매내전 화면에서 팀장 선출 → 포인트 → 입찰 → 매치 진행.",
			].join("\n"),
			ephemeral: true,
		});
	} catch {
		// expired token — 채널 메시지는 이미 갱신됨 (editReply)
	}
}
