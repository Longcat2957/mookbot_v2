// /경매내전조기종료 — IN_PROGRESS 단계 (CAPTAIN_PICK ~ IN_GAME) 의 경매 토너먼트를
// 운영자가 graceful 하게 중도 취소. softDelete (응급 강제삭제) 와 달리 historical 보존:
//   - auction_tournaments.status = 'CANCELLED' (행 + 종속 데이터 그대로)
//   - 진행 중인 auction_matches 도 같이 CANCELLED (winning_team 미결)
// 모집/팀/입찰 기록은 audit 가시성 위해 유지. 진짜 물리/완전 삭제는 `/경매강제삭제`.

import { db } from "@mookbot/core";
import {
	ActionRowBuilder,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	type ChatInputCommandInteraction,
	EmbedBuilder,
	SlashCommandBuilder,
} from "discord.js";
import { notify } from "../utils/notify.js";
import { requireOperator } from "../utils/operator.js";

const {
	getAuctionTournament,
	listAuctionMatches,
	cancelAuctionTournament,
	cancelAuctionMatch,
	recordAudit,
} = db;

export const data = new SlashCommandBuilder()
	.setName("경매조기종료")
	.setDescription("[운영자] 진행중 경매내전 토너먼트를 graceful 취소 (historical 보존)")
	.addIntegerOption((o) =>
		o.setName("토너먼트").setDescription("종료할 토너먼트 ID").setRequired(true).setMinValue(1),
	);

const ACTIVE_STATUSES = [
	"CAPTAIN_PICK",
	"POINT_ALLOC",
	"BIDDING",
	"PLACEMENT",
	"BRACKET_SETUP",
	"IN_GAME",
] as const;

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!(await requireOperator(interaction))) return;

	const tournamentId = interaction.options.getInteger("토너먼트", true);
	await interaction.deferReply({ ephemeral: true });

	const t = await getAuctionTournament(tournamentId);
	if (!t) {
		await interaction.editReply(`❌ 토너먼트 #${tournamentId} 를 찾을 수 없습니다.`);
		return;
	}
	if (!ACTIVE_STATUSES.includes(t.status as (typeof ACTIVE_STATUSES)[number])) {
		await interaction.editReply(
			`❌ 토너먼트 #${tournamentId} 는 이미 ${t.status} 상태입니다. graceful 취소는 진행중 (CAPTAIN_PICK~IN_GAME) 단계만.`,
		);
		return;
	}

	const matches = await listAuctionMatches(tournamentId);
	const inProgressMatches = matches.filter((m) => m.status === "IN_PROGRESS");
	const completedMatches = matches.filter((m) => m.status === "COMPLETED");

	const embed = new EmbedBuilder()
		.setTitle(`⚠️ 경매내전 #${tournamentId} 조기 종료 미리보기`)
		.setColor(0xe8b339)
		.addFields(
			{ name: "현재 상태", value: t.status, inline: true },
			{ name: "포맷", value: `${t.format}인`, inline: true },
			{ name: "진행 중 매치", value: String(inProgressMatches.length), inline: true },
			{ name: "완료된 매치", value: String(completedMatches.length), inline: true },
		)
		.setDescription(
			[
				"토너먼트가 **CANCELLED** 로 마킹됩니다 (history 보존).",
				"진행 중인 매치도 같이 CANCELLED (winning_team 미결).",
				"완료된 매치 결과는 그대로 유지.",
				"완전 삭제는 `/경매강제삭제` 사용.",
			].join("\n"),
		);

	const confirmId = `admin:confirm:auction_tournament_early_cancel:${tournamentId}`;
	const cancelId = `admin:cancel:auction_tournament_early_cancel:${tournamentId}`;
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setCustomId(confirmId).setLabel("확정 취소").setStyle(ButtonStyle.Danger),
		new ButtonBuilder().setCustomId(cancelId).setLabel("닫기").setStyle(ButtonStyle.Secondary),
	);

	await interaction.editReply({ embeds: [embed], components: [row] });
}

export async function handleButton(interaction: ButtonInteraction): Promise<void> {
	const parts = interaction.customId.split(":");
	if (parts[2] !== "auction_tournament_early_cancel") return;
	if (!(await requireOperator(interaction))) return;

	if (parts[1] === "cancel") {
		await interaction.update({ content: "닫혔습니다.", embeds: [], components: [] });
		return;
	}

	const tournamentId = Number(parts[3]);
	await interaction.deferUpdate();

	const t = await getAuctionTournament(tournamentId);
	if (!t) {
		await interaction.editReply({
			content: `❌ 토너먼트 #${tournamentId} 가 사라졌습니다.`,
			embeds: [],
			components: [],
		});
		return;
	}
	if (!ACTIVE_STATUSES.includes(t.status as (typeof ACTIVE_STATUSES)[number])) {
		await interaction.editReply({
			content: `❌ 토너먼트 #${tournamentId} 가 이미 ${t.status} 상태입니다.`,
			embeds: [],
			components: [],
		});
		return;
	}

	const matches = await listAuctionMatches(tournamentId);
	const inProgress = matches.filter((m) => m.status === "IN_PROGRESS");

	// 1) 진행 중 매치들을 CANCELLED — 한 개씩 (cancelAuctionMatch 가 IN_PROGRESS 만 처리)
	for (const m of inProgress) {
		await cancelAuctionMatch(m.id);
	}
	// 2) 토너먼트 자체 CANCELLED
	await cancelAuctionTournament(tournamentId);

	await recordAudit({
		operatorId: interaction.user.id,
		action: "auction-tournament.early_cancel",
		targetType: "auction-tournament",
		targetId: String(tournamentId),
		payload: {
			originalStatus: t.status,
			cancelledMatchIds: inProgress.map((m) => m.id),
			completedMatchIds: matches.filter((m) => m.status === "COMPLETED").map((m) => m.id),
		},
	});

	void notify("auction-dashboard");
	void notify(`auction-tournament:${tournamentId}`);

	await interaction.editReply({
		content: `✅ 경매내전 #${tournamentId} 조기 종료 완료 — 진행 중 매치 ${inProgress.length}건도 같이 CANCELLED.`,
		embeds: [],
		components: [],
	});
}
