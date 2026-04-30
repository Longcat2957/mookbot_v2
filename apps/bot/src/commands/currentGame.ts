import {
	type ChatInputCommandInteraction,
	EmbedBuilder,
	SlashCommandBuilder,
} from "discord.js";
import { datadragon, db, riot } from "@mookbot/core";

export const data = new SlashCommandBuilder()
	.setName("지금게임")
	.setDescription("현재 라이브 게임 (Spectator) 조회")
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
					content: `${target.displayName} 님은 라이엇 ID 가 연결되지 않았습니다.`,
				});
				return;
			}
			puuid = main.puuid;
			displayName = `${main.game_name}#${main.tag_line}`;
		}

		const game = await riot.getCurrentGameByPuuid(puuid).catch(() => null);
		if (!game) {
			await interaction.editReply({ content: `❌ ${displayName} 님은 현재 게임 중이 아닙니다.` });
			return;
		}

		const lengthMin = Math.floor(game.gameLength / 60);
		const lengthSec = game.gameLength % 60;
		const blueTeam = game.participants.filter((p) => p.teamId === 100);
		const redTeam = game.participants.filter((p) => p.teamId === 200);

		const fmt = (p: { championId: number; riotId?: string; puuid: string }) => {
			const champ = datadragon.getChampionName(p.championId);
			const id = p.riotId ?? `${p.puuid.slice(0, 6)}…`;
			return `**${champ}** · ${id}`;
		};

		const eb = new EmbedBuilder()
			.setTitle(`🎮 ${displayName} — 라이브 게임`)
			.setDescription(
				`Mode: \`${game.gameMode}\` · Queue: \`${game.gameQueueConfigId}\` · 진행: ${lengthMin}분 ${lengthSec}초`,
			)
			.setColor(0x22a55a);

		if (blueTeam.length > 0) {
			eb.addFields({
				name: "🔵 BLUE",
				value: blueTeam.map(fmt).join("\n"),
				inline: true,
			});
		}
		if (redTeam.length > 0) {
			eb.addFields({
				name: "🔴 RED",
				value: redTeam.map(fmt).join("\n"),
				inline: true,
			});
		}

		if (game.bannedChampions && game.bannedChampions.length > 0) {
			const blueBans = game.bannedChampions
				.filter((b) => b.teamId === 100)
				.map((b) => datadragon.getChampionName(b.championId))
				.join(", ");
			const redBans = game.bannedChampions
				.filter((b) => b.teamId === 200)
				.map((b) => datadragon.getChampionName(b.championId))
				.join(", ");
			eb.addFields({
				name: "밴",
				value: `🔵 ${blueBans || "_없음_"}\n🔴 ${redBans || "_없음_"}`,
			});
		}

		await interaction.editReply({ embeds: [eb] });
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		await interaction.editReply({ content: `❌ 라이엇 API 조회 실패: ${msg}` });
	}
}
