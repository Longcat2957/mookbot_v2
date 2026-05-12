// /내정보갱신 — 본인 라이엇 계정의 소환사 아이콘 (profileIconId) 을 Riot API 로 다시 fetch.
// 사용자가 League 안에서 아이콘 변경 시 즉시 반영. Summoner-V4 호출 1회/계정.

import { db, riot } from "@mookbot/core";
import {
	ApplicationIntegrationType,
	type ChatInputCommandInteraction,
	InteractionContextType,
	SlashCommandBuilder,
} from "discord.js";

export const data = new SlashCommandBuilder()
	.setName("내정보갱신")
	.setDescription("내 라이엇 계정의 소환사 아이콘을 다시 가져옵니다.")
	.setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
	.setContexts(InteractionContextType.Guild);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	await interaction.deferReply({ ephemeral: true });

	const accounts = await db.getRiotAccountsByUser(interaction.user.id);
	if (accounts.length === 0) {
		await interaction.editReply({
			content: "연결된 라이엇 계정이 없습니다. `/등록` 으로 먼저 연결하세요.",
		});
		return;
	}

	const results: string[] = [];
	for (const acc of accounts) {
		try {
			const summoner = await riot.getSummonerByPuuid(acc.puuid);
			if (summoner?.profileIconId != null && summoner.profileIconId !== acc.profile_icon_id) {
				await db.setRiotAccountProfileIcon(acc.puuid, summoner.profileIconId);
				results.push(
					`✓ **${acc.game_name}#${acc.tag_line}** — 아이콘 ${acc.profile_icon_id ?? "?"} → ${summoner.profileIconId}`,
				);
			} else if (summoner?.profileIconId != null) {
				results.push(`= **${acc.game_name}#${acc.tag_line}** — 변경 없음 (${summoner.profileIconId})`);
			} else {
				results.push(`⚠️ **${acc.game_name}#${acc.tag_line}** — Summoner-V4 응답에 아이콘 없음`);
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			results.push(`✗ **${acc.game_name}#${acc.tag_line}** — ${msg}`);
		}
	}

	await interaction.editReply({
		content: ["### 🔄 소환사 아이콘 갱신", ...results].join("\n"),
	});
}
