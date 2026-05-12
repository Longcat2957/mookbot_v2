// /랜덤인원추가 — 테스트용. 등록된 사용자 풀에서 랜덤 N명을 모집에 추가.
// 일반/경매 모집 자동 감지. 운영자 본인 / 이미 참가 / test-* dummy 자동 제외.
// 모집 메시지 자동 갱신 — 정원 도달 시 [▶ 엔트리 수정 / 경매 시작] 버튼 자연 노출.
//
// 테스트 후 cleanup: `/시리즈강제삭제 series_id:N rollback_mmr:true` 로 MMR 정확 복원.

import { cloudflare, db } from "@mookbot/core";
import {
	ApplicationIntegrationType,
	type ChatInputCommandInteraction,
	InteractionContextType,
	SlashCommandBuilder,
} from "discord.js";
import { notify } from "../utils/notify.js";
import { requireOperator } from "../utils/operator.js";
import { refreshAuctionRecruitMessage } from "./auctionRecruit/messageBuilder.js";
import { refreshRecruitMessage } from "./recruit/messageBuilder.js";

export const data = new SlashCommandBuilder()
	.setName("랜덤인원추가")
	.setDescription("[운영자] 테스트용 — 모집에 랜덤 등록 사용자 N명 추가")
	.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
	.setContexts(InteractionContextType.Guild)
	.addIntegerOption((o) =>
		o
			.setName("모집")
			.setDescription("모집 ID (일반/경매 자동 감지)")
			.setRequired(true)
			.setMinValue(1),
	)
	.addIntegerOption((o) =>
		o
			.setName("인원")
			.setDescription("추가할 랜덤 인원 (1~20)")
			.setRequired(true)
			.setMinValue(1)
			.setMaxValue(20),
	);

interface UserRow {
	discord_id: string;
	display_name: string;
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!(await requireOperator(interaction))) return;

	const recruitmentId = interaction.options.getInteger("모집", true);
	const requested = interaction.options.getInteger("인원", true);
	const operatorId = interaction.user.id;

	await interaction.deferReply({ ephemeral: true });

	// 일반 / 경매 자동 감지
	const normalRec = await db.getRecruitment(recruitmentId);
	const auctionRec = !normalRec ? await db.getAuctionRecruitment(recruitmentId) : null;
	if (!normalRec && !auctionRec) {
		await interaction.editReply(`❌ 모집 #${recruitmentId} 를 찾을 수 없습니다.`);
		return;
	}

	const isAuction = !!auctionRec;
	const rec = normalRec ?? auctionRec!;
	if (rec.status !== "OPEN") {
		await interaction.editReply(`❌ 모집 status=${rec.status} — OPEN 일 때만 추가 가능.`);
		return;
	}

	const existing = isAuction
		? await db.listAuctionRecruitmentParticipants(recruitmentId)
		: await db.listRecruitmentParticipants(recruitmentId);
	const remaining = rec.target_count - existing.length;
	if (remaining <= 0) {
		await interaction.editReply(`❌ 모집 정원 이미 가득 (${existing.length}/${rec.target_count}).`);
		return;
	}
	const want = Math.min(requested, remaining);

	// 랜덤 사용자 풀 추출 — 운영자 본인 / 이미 참가 / dummy 제외
	const excludeIds = new Set<string>([operatorId, ...existing.map((p) => p.user_id)]);
	const placeholders = [...excludeIds].map(() => "?").join(", ");
	const candidates = await cloudflare.query<UserRow>(
		`SELECT discord_id, display_name FROM users
		 WHERE discord_id NOT IN (${placeholders || "''"})
		   AND discord_id NOT LIKE 'test-%'
		 ORDER BY RANDOM()
		 LIMIT ?`,
		[...excludeIds, want],
	);

	if (candidates.length === 0) {
		await interaction.editReply(
			`❌ 추가 가능한 등록 사용자가 없습니다 (이미 참가 ${existing.length}, 운영자 1, 풀 부족).`,
		);
		return;
	}

	// 추가 — 일반/경매 분기
	for (const u of candidates) {
		if (isAuction) {
			await db.addAuctionRecruitmentParticipant({
				recruitmentId,
				userId: u.discord_id,
			});
		} else {
			await db.addRecruitmentParticipant({ recruitmentId, userId: u.discord_id });
			// 일반은 라인 선호 default (빈 배열 = 라인 무관)
			await db.setRecruitmentRoles(recruitmentId, u.discord_id, []);
		}
	}

	await db.recordAudit({
		operatorId,
		action: isAuction ? "auction-recruitment.random-bulk-add" : "recruitment.random-bulk-add",
		targetType: isAuction ? "auction-recruitment" : "recruitment",
		targetId: String(recruitmentId),
		payload: {
			requested,
			added: candidates.length,
			userIds: candidates.map((u) => u.discord_id),
		},
	});

	// 모집 메시지 갱신 — 정원 도달 시 [▶ 다음 단계] 버튼 자동 노출
	const refreshError = isAuction
		? await refreshAuctionRecruitMessage(
				interaction,
				recruitmentId,
				auctionRec!.channel_id,
				auctionRec!.message_id,
			)
		: await refreshRecruitMessage(
				interaction,
				recruitmentId,
				normalRec!.channel_id,
				normalRec!.message_id,
			);
	void notify(isAuction ? `auction-recruitment:${recruitmentId}` : `recruitment:${recruitmentId}`);
	void notify(isAuction ? "auction-dashboard" : "dashboard");

	const newCount = existing.length + candidates.length;
	const partial = candidates.length < want;
	const header = partial
		? `⚠️ 모집 #${recruitmentId} — 랜덤 ${candidates.length}명 추가 (요청 ${requested}, 풀 부족)`
		: `✅ 모집 #${recruitmentId} — 랜덤 ${candidates.length}명 추가`;
	const lines = [
		`### ${header}`,
		`정원: ${existing.length}/${rec.target_count} → **${newCount}/${rec.target_count}**${newCount >= rec.target_count ? " (정원 도달)" : ""}`,
		`종류: ${isAuction ? "🎟️ 경매내전" : "📋 일반 내전"}`,
		"",
		"**추가된 사용자:**",
		...candidates.map((u, i) => `${i + 1}. **${u.display_name}** (<@${u.discord_id}>)`),
	];
	if (refreshError) {
		lines.push("", `⚠️ 모집 메시지 갱신 실패: \`${refreshError}\``);
	}
	lines.push(
		"",
		"_테스트 후 cleanup: `/시리즈강제삭제 series_id:N rollback_mmr:true` 로 MMR 정확 복원._",
	);

	await interaction.editReply({ content: lines.join("\n") });
}
