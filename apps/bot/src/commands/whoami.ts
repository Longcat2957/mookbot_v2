import { db } from "@mookbot/core";
import { type ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";

const ROLE_LABEL: Record<string, string> = {
	TOP: "탑",
	JUNGLE: "정글",
	MID: "미드",
	BOTTOM: "원딜",
	SUPPORT: "서폿",
};

function formatMmr(mmr: number): string {
	return String(Math.round(mmr));
}

export const data = new SlashCommandBuilder()
	.setName("내정보")
	.setDescription("내 등록 정보 + 시즌 라인별 MMR")
	.addUserOption((o) =>
		o.setName("user").setDescription("(선택) 다른 사용자 조회").setRequired(false),
	);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	const target = interaction.options.getUser("user") ?? interaction.user;
	await interaction.deferReply({ ephemeral: true });

	const user = await db.getUser(target.id);
	if (!user) {
		await interaction.editReply({
			content: `${target.displayName} 님은 아직 등록되지 않았습니다. \`/등록\` 으로 등록하세요.`,
		});
		return;
	}

	const riotAccounts = await db.getRiotAccountsByUser(target.id);
	const main = await db.getMainRiotAccount(target.id);
	const season = await db.getCurrentSeason();

	const eb = new EmbedBuilder().setTitle(`📇 ${user.display_name} 의 정보`).setColor(0x5b6df2);

	if (riotAccounts.length === 0) {
		eb.addFields({
			name: "라이엇 계정",
			value: "_연결된 라이엇 ID 없음_ — `/등록 riot_id:...` 으로 연결 가능",
		});
	} else {
		const lines = riotAccounts.map((a) => {
			const mainBadge = a.puuid === main?.puuid ? " ⭐" : "";
			return `${a.game_name}#${a.tag_line}${mainBadge}`;
		});
		eb.addFields({ name: "라이엇 계정", value: lines.join("\n") });
	}

	if (season) {
		const mmrs = await db.getLaneMmrs(
			(["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const).map((r) => ({
				userId: target.id,
				role: r,
			})),
			season.id,
		);
		const lines = (["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const).map((role) => {
			const m = mmrs.find((x) => x.role === role);
			if (!m || m.games_played === 0) {
				return `${ROLE_LABEL[role]}: _기록 없음_`;
			}
			const wr = m.games_played > 0 ? Math.round((m.wins / m.games_played) * 100) : 0;
			const losses = m.games_played - m.wins;
			return `${ROLE_LABEL[role]}: **${formatMmr(m.mmr)}** · ${m.games_played}G ${m.wins}승 ${losses}패 (${wr}%)`;
		});
		eb.addFields({ name: `시즌 ${season.id} 라인 MMR`, value: lines.join("\n") });
	}

	await interaction.editReply({ embeds: [eb] });
}
