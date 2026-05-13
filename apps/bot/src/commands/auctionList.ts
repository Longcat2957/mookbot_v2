// /경매내전목록 — 운영자가 최근 경매내전 토너먼트를 한눈에 확인. 상태/시즌/limit 필터.
// /시리즈목록 (RANKED) 의 AUCTION 페어. 각 토너먼트 1줄 요약 — 매치 진행 현황 + 챔피언 팀.

import { db } from "@mookbot/core";
import { type ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { requireOperator } from "../utils/operator.js";

type Status =
	| "CAPTAIN_PICK"
	| "POINT_ALLOC"
	| "BIDDING"
	| "PLACEMENT"
	| "BRACKET_SETUP"
	| "IN_GAME"
	| "COMPLETED"
	| "CANCELLED";

const STATUS_LABEL: Record<Status, string> = {
	CAPTAIN_PICK: "🎯 팀장선출",
	POINT_ALLOC: "💰 포인트분배",
	BIDDING: "🔨 입찰중",
	PLACEMENT: "🧩 수동배치",
	BRACKET_SETUP: "🗂️ 대진작성",
	IN_GAME: "🟢 매치진행",
	COMPLETED: "🏁 종료",
	CANCELLED: "🛑 취소",
};

export const data = new SlashCommandBuilder()
	.setName("경매목록")
	.setDescription("[운영자] 최근 경매내전 토너먼트 목록 조회")
	.addStringOption((o) =>
		o
			.setName("상태")
			.setDescription("상태 필터 (미지정 시 전체)")
			.addChoices(
				{ name: "팀장 선출", value: "CAPTAIN_PICK" },
				{ name: "포인트 분배", value: "POINT_ALLOC" },
				{ name: "입찰 중", value: "BIDDING" },
				{ name: "수동 배치", value: "PLACEMENT" },
				{ name: "대진 작성", value: "BRACKET_SETUP" },
				{ name: "매치 진행", value: "IN_GAME" },
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

	const tournaments = await db.listAuctionTournaments({
		...(status ? { status } : {}),
		...(seasonId !== undefined ? { seasonId } : {}),
		limit,
	});
	if (tournaments.length === 0) {
		const filterDesc = [
			status ? STATUS_LABEL[status] : null,
			seasonId !== undefined ? `시즌 #${seasonId}` : null,
		]
			.filter(Boolean)
			.join(" · ");
		await interaction.editReply(
			`해당 조건의 경매내전이 없습니다.${filterDesc ? ` (${filterDesc})` : ""}`,
		);
		return;
	}

	// 토너먼트별: 매치 진행 현황 + 운영자 이름 fetch
	const [matchesAll, creators] = await Promise.all([
		Promise.all(tournaments.map((t) => db.listAuctionMatches(t.id))),
		(async () => {
			const ids = [...new Set(tournaments.map((t) => t.created_by).filter(Boolean) as string[])];
			return ids.length > 0 ? db.listUsers(ids) : [];
		})(),
	]);
	const nameById = new Map(creators.map((u) => [u.discord_id, u.display_name]));

	const lines = tournaments.map((t, i) => {
		const matches = matchesAll[i] ?? [];
		const completed = matches.filter((m) => m.status === "COMPLETED").length;
		const cancelled = matches.filter((m) => m.status === "CANCELLED").length;
		const inProg = matches.filter((m) => m.status === "IN_PROGRESS").length;
		const creator = t.created_by ? (nameById.get(t.created_by) ?? t.created_by) : "—";
		const matchSummary =
			matches.length > 0
				? `매치 ${completed}완 / ${inProg}진행 / ${cancelled}취소 (총 ${matches.length})`
				: "매치 0";
		return [
			`**경매 #${t.id}** · ${STATUS_LABEL[t.status as Status]}`,
			`${t.format}인 · ${matchSummary} · 시즌 #${t.season_id}`,
			`시작 ${formatKstDate(t.started_at)} · 운영자 ${creator}`,
		].join("\n");
	});

	const filterDesc = [
		status ? STATUS_LABEL[status] : "전체",
		seasonId !== undefined ? `시즌 #${seasonId}` : null,
		`최근 ${tournaments.length}개`,
	]
		.filter(Boolean)
		.join(" · ");

	const eb = new EmbedBuilder()
		.setTitle("🎟️ 경매내전 목록")
		.setDescription(lines.join("\n\n"))
		.setColor(0x9b59b6)
		.setFooter({ text: filterDesc });

	await interaction.editReply({ embeds: [eb] });
}
