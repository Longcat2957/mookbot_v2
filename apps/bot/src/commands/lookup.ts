import {
	type ChatInputCommandInteraction,
	EmbedBuilder,
	SlashCommandBuilder,
} from "discord.js";
import { datadragon, db, riot } from "@mookbot/core";

export const data = new SlashCommandBuilder()
	.setName("전적")
	.setDescription("라이엇 솔로/자유 랭크 + 챔피언 마스터리 top 5")
	.addStringOption((o) =>
		o.setName("riot_id").setDescription("(선택) GameName#TagLine. 비우면 본인 메인 계정"),
	)
	.addUserOption((o) =>
		o.setName("user").setDescription("(선택) 다른 사용자의 메인 계정"),
	);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	const riotIdInput = interaction.options.getString("riot_id");
	const targetUser = interaction.options.getUser("user");
	await interaction.deferReply({ ephemeral: false });

	let puuid: string | undefined;
	let displayName = "";

	try {
		if (riotIdInput) {
			riot.parseRiotId(riotIdInput);
			const account = await riot.getAccountByRiotId(riotIdInput);
			puuid = account.puuid;
			displayName = `${account.gameName}#${account.tagLine}`;
		} else {
			const target = targetUser ?? interaction.user;
			const main = await db.getMainRiotAccount(target.id);
			if (!main) {
				await interaction.editReply({
					content: `${target.displayName} 님은 라이엇 ID 가 연결되지 않았습니다. \`/등록 riot_id:...\``,
				});
				return;
			}
			puuid = main.puuid;
			displayName = `${main.game_name}#${main.tag_line}`;
		}

		const [entries, masteries] = await Promise.all([
			riot.getLeagueEntries(puuid).catch(() => []),
			riot.getTopMasteries(puuid, 5).catch(() => []),
		]);

		const eb = new EmbedBuilder()
			.setTitle(`🔎 ${displayName}`)
			.setColor(0x5b6df2);

		eb.addFields({
			name: "랭크",
			value: entries.length === 0 ? "_Unranked_" : riot.formatLeagueEntries(entries),
		});

		if (masteries.length > 0) {
			const lines = masteries.map((m, i) => {
				const name = datadragon.getChampionName(m.championId);
				const points = m.championPoints.toLocaleString("ko-KR");
				return `${i + 1}. **${name}** · Lv.${m.championLevel} · ${points}p`;
			});
			eb.addFields({ name: "챔피언 마스터리 Top 5", value: lines.join("\n") });
		} else {
			eb.addFields({ name: "챔피언 마스터리 Top 5", value: "_데이터 없음_" });
		}

		await interaction.editReply({ embeds: [eb] });
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		await interaction.editReply({
			content: `❌ 라이엇 API 조회 실패: ${msg}`,
		});
	}
}
