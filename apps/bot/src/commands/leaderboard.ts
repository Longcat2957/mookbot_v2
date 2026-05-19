import { db } from "@mookbot/core";
import { type ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";

const ROLES = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;
const ROLE_LABEL: Record<(typeof ROLES)[number], string> = {
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
	.setName("랭킹")
	.setDescription("라인별 시즌 MMR 상위 랭킹 (상위 10)")
	.addStringOption((o) =>
		o
			.setName("라인")
			.setDescription("조회할 라인")
			.setRequired(true)
			.addChoices(
				{ name: "탑", value: "TOP" },
				{ name: "정글", value: "JUNGLE" },
				{ name: "미드", value: "MID" },
				{ name: "원딜", value: "BOTTOM" },
				{ name: "서폿", value: "SUPPORT" },
			),
	);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	const role = interaction.options.getString("라인", true) as (typeof ROLES)[number];
	await interaction.deferReply();

	const season = await db.getCurrentSeason();
	if (!season) {
		await interaction.editReply({ content: "활성 시즌이 없습니다." });
		return;
	}

	const rows = await db.getLeaderboard(season.id, role, 10);
	if (rows.length === 0) {
		await interaction.editReply({
			content: `${ROLE_LABEL[role]} 라인 기록이 아직 없습니다.`,
		});
		return;
	}

	const users = await db.listUsers(rows.map((r) => r.user_id));
	const nameById = new Map(users.map((u) => [u.discord_id, u.display_name]));

	const lines = rows.map((r, i) => {
		const losses = r.games_played - r.wins;
		const wr = r.games_played > 0 ? Math.round((r.wins / r.games_played) * 100) : 0;
		const name = nameById.get(r.user_id) ?? r.user_id;
		const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
		return `${medal} **${name}** · ${formatMmr(r.mmr)} · ${r.games_played}G ${r.wins}-${losses} (${wr}%)`;
	});

	const eb = new EmbedBuilder()
		.setTitle(`🏆 시즌 ${season.id} · ${ROLE_LABEL[role]} 랭킹`)
		.setDescription(lines.join("\n"))
		.setColor(0xe8b339);

	await interaction.editReply({ embeds: [eb] });
}
