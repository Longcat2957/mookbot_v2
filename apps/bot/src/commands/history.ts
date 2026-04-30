import {
	type ChatInputCommandInteraction,
	EmbedBuilder,
	SlashCommandBuilder,
} from "discord.js";
import { db } from "@mookbot/core";

const ROLES = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;
const ROLE_LABEL: Record<(typeof ROLES)[number], string> = {
	TOP: "탑",
	JUNGLE: "정글",
	MID: "미드",
	BOTTOM: "원딜",
	SUPPORT: "서폿",
};

export const data = new SlashCommandBuilder()
	.setName("내전기록")
	.setDescription("내전 라인별 통계 + 최근 MMR 변동")
	.addUserOption((o) =>
		o.setName("user").setDescription("(선택) 다른 사용자").setRequired(false),
	);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	const target = interaction.options.getUser("user") ?? interaction.user;
	await interaction.deferReply({ ephemeral: true });

	const user = await db.getUser(target.id);
	if (!user) {
		await interaction.editReply({
			content: `${target.displayName} 님은 등록되지 않았습니다.`,
		});
		return;
	}

	const season = await db.getCurrentSeason();
	if (!season) {
		await interaction.editReply({ content: "활성 시즌이 없습니다." });
		return;
	}

	const mmrs = await db.getLaneMmrs(
		ROLES.map((r) => ({ userId: target.id, role: r })),
		season.id,
	);
	const changes = await db.getMmrChangesForUser(target.id, 10);

	const totals = mmrs.reduce(
		(acc, m) => ({
			plays: acc.plays + m.games_played,
			wins: acc.wins + m.wins,
		}),
		{ plays: 0, wins: 0 },
	);
	const totalLosses = totals.plays - totals.wins;
	const totalWr = totals.plays > 0 ? Math.round((totals.wins / totals.plays) * 100) : 0;

	const eb = new EmbedBuilder()
		.setTitle(`📊 ${user.display_name} 의 내전 기록`)
		.setDescription(
			`시즌 ${season.id} · 총 **${totals.plays}**G · ${totals.wins}승 ${totalLosses}패 (${totalWr}%)`,
		)
		.setColor(0x5b6df2);

	const laneLines = ROLES.map((role) => {
		const m = mmrs.find((x) => x.role === role);
		if (!m || m.games_played === 0) return `${ROLE_LABEL[role]}: _기록 없음_`;
		const losses = m.games_played - m.wins;
		const wr = m.games_played > 0 ? Math.round((m.wins / m.games_played) * 100) : 0;
		return `${ROLE_LABEL[role]}: **${m.mmr}** · ${m.games_played}G ${m.wins}-${losses} (${wr}%)`;
	});
	eb.addFields({ name: "라인별 MMR", value: laneLines.join("\n") });

	if (changes.length > 0) {
		const recentLines = changes.slice(0, 10).map((c) => {
			const sign = c.delta > 0 ? "+" : "";
			const arrow = c.delta > 0 ? "📈" : "📉";
			return `${arrow} ${ROLE_LABEL[c.role]} ${sign}${c.delta} → ${c.mmr_after}`;
		});
		eb.addFields({ name: "최근 MMR 변동", value: recentLines.join("\n") });
	}

	await interaction.editReply({ embeds: [eb] });
}
