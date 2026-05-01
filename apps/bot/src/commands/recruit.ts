// /내전모집 — 슬래시 진입점 (data + execute) + 핸들러 re-export.
//
// 서브 모듈은 ./recruit/ 디렉토리:
//   - types.ts            RoleSlot / ROLE_LABEL
//   - messageBuilder.ts   V2 컴포넌트 빌더 + 메시지 갱신 폴백
//   - buttonHandlers.ts   참여/취소/멤버관리/엔트리 진입 버튼
//   - selectHandlers.ts   라인 선호 + 운영자 멤버관리 셀렉트
//
// events/interactionCreate.ts 가 재export 한 handle* 를 dispatch 하므로
// 외부 인터페이스 (export name) 변경 0.

import { db } from "@mookbot/core";
import {
	ApplicationIntegrationType,
	type ChatInputCommandInteraction,
	InteractionContextType,
	SlashCommandBuilder,
} from "discord.js";
import { v2Ephemeral, v2Error, v2Reply } from "../utils/v2.js";
import { renderComponents } from "./recruit/messageBuilder.js";

export { handleButton } from "./recruit/buttonHandlers.js";
export { handleStringSelect } from "./recruit/selectHandlers.js";

const { createRecruitment, setRecruitmentMessage, upsertUser, getCurrentSeason, createSeason } = db;

export const data = new SlashCommandBuilder()
	.setName("내전모집")
	.setDescription("내전 참가자를 모집합니다.")
	// Guild Install + Guild context 만 허용 — User Install context 면 응답이 ephemeral 처리됨
	.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
	.setContexts(InteractionContextType.Guild)
	.addIntegerOption((o) =>
		o
			.setName("정원")
			.setDescription("총 인원 (2/4/6/8/10)")
			.addChoices(
				{ name: "1v1 (2명)", value: 2 },
				{ name: "2v2 (4명)", value: 4 },
				{ name: "3v3 (6명)", value: 6 },
				{ name: "4v4 (8명)", value: 8 },
				{ name: "5v5 (10명)", value: 10 },
			)
			.setRequired(true),
	);

async function ensureSeasonId(): Promise<number> {
	const cur = await getCurrentSeason();
	if (cur) return cur.id;
	const created = await createSeason("Season 1");
	return created.id;
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!interaction.inGuild()) {
		await interaction.reply(v2Ephemeral(v2Error("서버에서만 사용 가능합니다.")));
		return;
	}
	const targetCount = interaction.options.getInteger("정원", true);

	await upsertUser(interaction.user.id, interaction.user.displayName);
	const seasonId = await ensureSeasonId();

	const rec = await createRecruitment({
		seasonId,
		targetCount,
		createdBy: interaction.user.id,
	});

	const components = await renderComponents(rec.id);
	await interaction.reply(v2Reply(...components));
	const msg = await interaction.fetchReply();
	await setRecruitmentMessage(rec.id, msg.channelId, msg.id);
}
