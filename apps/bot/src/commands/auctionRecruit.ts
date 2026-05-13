// /경매내전모집 — 슬래시 진입점 (data + execute) + 핸들러 re-export.

import { db } from "@mookbot/core";
import {
	ApplicationIntegrationType,
	type ChatInputCommandInteraction,
	InteractionContextType,
	SlashCommandBuilder,
} from "discord.js";
import { resolveGuildDisplayName } from "../utils/displayName.js";
import { v2Ephemeral, v2Error, v2Reply } from "../utils/v2.js";
import { renderComponents } from "./auctionRecruit/messageBuilder.js";

export { handleButton } from "./auctionRecruit/buttonHandlers.js";

const {
	createAuctionRecruitment,
	setAuctionRecruitmentMessage,
	upsertUser,
	getCurrentSeason,
	createSeason,
	recordAudit,
} = db;

export const data = new SlashCommandBuilder()
	.setName("경매모집")
	.setDescription("경매내전 (이벤트성) 참가자를 모집합니다. MMR 영향 없음.")
	.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
	.setContexts(InteractionContextType.Guild)
	.addIntegerOption((o) =>
		o
			.setName("정원")
			.setDescription("총 인원 (10 또는 20)")
			.addChoices(
				{ name: "10인 (1매치 5v5)", value: 10 },
				{ name: "20인 (4팀 토너먼트 4강+결승)", value: 20 },
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
	const targetCount = interaction.options.getInteger("정원", true) as 10 | 20;

	const displayName = await resolveGuildDisplayName(interaction.guild, interaction.user);
	await upsertUser(interaction.user.id, displayName);
	const seasonId = await ensureSeasonId();

	const rec = await createAuctionRecruitment({
		seasonId,
		targetCount,
		createdBy: interaction.user.id,
	});
	await recordAudit({
		operatorId: interaction.user.id,
		action: "auction-recruitment.created",
		targetType: "auction-recruitment",
		targetId: String(rec.id),
		payload: { seasonId, targetCount },
	});

	const components = await renderComponents(rec.id);
	await interaction.reply(v2Reply(...components));
	const msg = await interaction.fetchReply();
	await setAuctionRecruitmentMessage(rec.id, msg.channelId, msg.id);
}
