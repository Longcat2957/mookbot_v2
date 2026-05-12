// /시리즈목록 — 운영자가 최근 시리즈를 한눈에 확인. 상태/시즌/limit 필터.
//
// 출력: 임베드 (각 시리즈 1줄). 시리즈 #N · 상태 · Bo3 (스코어) · 시작일 (KST) · 운영자.
// 종속 데이터 (참가자 / 게임 스코어) 는 시리즈마다 1쿼리씩 — limit 작아 (기본 10) 무리 없음.

import { db } from "@mookbot/core";
import { type ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { requireOperator } from "../utils/operator.js";

type Status = "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

const STATUS_LABEL: Record<Status, string> = {
	IN_PROGRESS: "🟢 진행중",
	COMPLETED: "🏁 종료",
	CANCELLED: "🛑 취소",
};

export const data = new SlashCommandBuilder()
	.setName("시리즈목록")
	.setDescription("[운영자] 최근 시리즈 목록 조회")
	.addStringOption((o) =>
		o
			.setName("상태")
			.setDescription("상태 필터 (미지정 시 전체)")
			.addChoices(
				{ name: "진행중", value: "IN_PROGRESS" },
				{ name: "종료", value: "COMPLETED" },
				{ name: "취소", value: "CANCELLED" },
			),
	)
	.addIntegerOption((o) =>
		o.setName("시즌").setDescription("시즌 ID (미지정 = 모든 시즌)").setMinValue(1),
	)
	.addIntegerOption((o) =>
		o.setName("limit").setDescription("표시 개수 (1~25, 기본 10)").setMinValue(1).setMaxValue(25),
	);

function formatKstDate(unix: number): string {
	// KST = UTC+9. server timezone 무관한 결정적 포맷.
	const d = new Date((unix + 9 * 3600) * 1000);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!(await requireOperator(interaction))) return;

	const status = interaction.options.getString("상태") as Status | null;
	const seasonId = interaction.options.getInteger("시즌") ?? undefined;
	const limit = interaction.options.getInteger("limit") ?? 10;

	await interaction.deferReply({ ephemeral: true });

	const series = await db.listSeries({
		...(status ? { status } : {}),
		...(seasonId !== undefined ? { seasonId } : {}),
		limit,
	});
	if (series.length === 0) {
		const filterDesc = [
			status ? STATUS_LABEL[status] : null,
			seasonId !== undefined ? `시즌 #${seasonId}` : null,
		]
			.filter(Boolean)
			.join(" · ");
		await interaction.editReply(
			`해당 조건의 시리즈가 없습니다.${filterDesc ? ` (${filterDesc})` : ""}`,
		);
		return;
	}

	// 종속 데이터 — 시리즈마다 wins / participants 한 번에 fetch
	const ids = series.map((s) => s.id);
	const winsAll = await Promise.all(ids.map((id) => db.countSeriesWins(id)));
	const partsAll = await Promise.all(ids.map((id) => db.getSeriesParticipants(id)));
	const allUserIds = [...new Set(partsAll.flat().map((p) => p.user_id))];
	const creators = [...new Set(series.map((s) => s.created_by).filter(Boolean) as string[])];
	const lookupIds = [...new Set([...allUserIds, ...creators])];
	const users = lookupIds.length > 0 ? await db.listUsers(lookupIds) : [];
	const nameById = new Map(users.map((u) => [u.discord_id, u.display_name]));

	const lines = series.map((s, i) => {
		const wins = winsAll[i] ?? { team1: 0, team2: 0 };
		const parts = partsAll[i] ?? [];
		const teamSize = parts.length / 2;
		const creator = s.created_by ? (nameById.get(s.created_by) ?? s.created_by) : "—";
		const score = `${wins.team1}-${wins.team2}`;
		const winSuffix =
			s.status === "COMPLETED" && s.winning_team
				? ` · ${s.winning_team === "TEAM_1" ? "1팀" : "2팀"} 승`
				: "";
		const sizeLabel = teamSize > 0 ? `${teamSize}v${teamSize}` : "—";
		const typeBadge = s.type === "AUCTION" ? " · 🎟️ 경매" : "";
		return [
			`**시리즈 #${s.id}** · ${STATUS_LABEL[s.status]}${typeBadge}`,
			`Bo3 (${score})${winSuffix} · ${sizeLabel} · 시즌 #${s.season_id}`,
			`시작 ${formatKstDate(s.started_at)} · 운영자 ${creator}`,
		].join("\n");
	});

	const filterDesc = [
		status ? STATUS_LABEL[status] : "전체",
		seasonId !== undefined ? `시즌 #${seasonId}` : null,
		`최근 ${series.length}개`,
	]
		.filter(Boolean)
		.join(" · ");

	const eb = new EmbedBuilder()
		.setTitle("📋 시리즈 목록")
		.setDescription(lines.join("\n\n"))
		.setColor(0x5865f2)
		.setFooter({ text: filterDesc });

	await interaction.editReply({ embeds: [eb] });
}
