// /시리즈조기종료 — IN_PROGRESS Bo3 시리즈를 운영자가 명시한 결과로 종료.
// 1경기 또는 2경기(1-1)로 끝난 시리즈를 깔끔히 마감하는 운영용 도구.
// 이미 기록된 게임의 MMR 변동은 보존 — 시리즈 status 만 종료 처리.

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

const { getSeries, listGamesInSeries, countSeriesWins, completeSeries, cancelSeries, recordAudit } =
	db;

type EarlyResult = "TEAM_1" | "TEAM_2" | "CANCEL";

export const data = new SlashCommandBuilder()
	.setName("시리즈조기종료")
	.setDescription("[운영자] 진행중 시리즈를 1경기/1-1 시점에서 강제 종료 (MMR 보존)")
	.addIntegerOption((o) =>
		o.setName("시리즈").setDescription("종료할 시리즈 ID").setRequired(true).setMinValue(1),
	)
	.addStringOption((o) =>
		o
			.setName("결과")
			.setDescription("최종 처리")
			.setRequired(true)
			.addChoices(
				{ name: "1팀 승 (COMPLETED)", value: "TEAM_1" },
				{ name: "2팀 승 (COMPLETED)", value: "TEAM_2" },
				{ name: "취소 / 무효 (CANCELLED)", value: "CANCEL" },
			),
	);

function resultLabel(r: EarlyResult): string {
	if (r === "TEAM_1") return "1팀 승 (COMPLETED)";
	if (r === "TEAM_2") return "2팀 승 (COMPLETED)";
	return "취소 / 무효 (CANCELLED)";
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!(await requireOperator(interaction))) return;

	const seriesId = interaction.options.getInteger("시리즈", true);
	const result = interaction.options.getString("결과", true) as EarlyResult;

	await interaction.deferReply({ ephemeral: true });

	const series = await getSeries(seriesId);
	if (!series) {
		await interaction.editReply(`❌ 시리즈 #${seriesId} 를 찾을 수 없습니다.`);
		return;
	}
	if (series.status !== "IN_PROGRESS") {
		await interaction.editReply(
			`❌ 시리즈 #${seriesId} 는 이미 ${series.status} 상태입니다. 조기 종료는 IN_PROGRESS 시리즈만 가능.`,
		);
		return;
	}

	const games = await listGamesInSeries(seriesId);
	if (games.length === 0) {
		await interaction.editReply(
			`❌ 게임 0개 시리즈는 보존할 데이터가 없습니다. \`/시리즈강제삭제 series_id:${seriesId}\` 사용.`,
		);
		return;
	}

	const wins = await countSeriesWins(seriesId);

	const embed = new EmbedBuilder()
		.setTitle(`⚠️ 시리즈 #${seriesId} 조기 종료 미리보기`)
		.setColor(0xe8b339)
		.addFields(
			{ name: "현재 상태", value: series.status, inline: true },
			{ name: "기록된 게임", value: `${games.length}경기`, inline: true },
			{
				name: "현재 스코어",
				value: `1팀 ${wins.team1} : ${wins.team2} 2팀`,
				inline: true,
			},
			{ name: "최종 처리", value: resultLabel(result), inline: false },
		)
		.setDescription(
			[
				"이미 기록된 게임의 결과/MMR 변동은 **그대로 보존**됩니다.",
				"시리즈 status 만 종료(COMPLETED/CANCELLED) 로 전환합니다.",
				"되돌리려면 `/시리즈강제삭제` 또는 직접 DB 수정 필요.",
			].join("\n"),
		);

	const confirmId = `admin:confirm:series_early_complete:${seriesId}:${result}`;
	const cancelId = `admin:cancel:series_early_complete:${seriesId}`;
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setCustomId(confirmId).setLabel("확정 종료").setStyle(ButtonStyle.Danger),
		new ButtonBuilder().setCustomId(cancelId).setLabel("취소").setStyle(ButtonStyle.Secondary),
	);

	await interaction.editReply({ embeds: [embed], components: [row] });
}

export async function handleButton(interaction: ButtonInteraction): Promise<void> {
	const parts = interaction.customId.split(":");
	if (parts[2] !== "series_early_complete") return;

	if (!(await requireOperator(interaction))) return;

	if (parts[1] === "cancel") {
		await interaction.update({ content: "취소되었습니다.", embeds: [], components: [] });
		return;
	}

	const seriesId = Number(parts[3]);
	const result = parts[4] as EarlyResult;
	if (result !== "TEAM_1" && result !== "TEAM_2" && result !== "CANCEL") {
		await interaction.update({
			content: `❌ 알 수 없는 결과: ${result}`,
			embeds: [],
			components: [],
		});
		return;
	}

	await interaction.deferUpdate();

	const series = await getSeries(seriesId);
	if (!series) {
		await interaction.editReply({
			content: `❌ 시리즈 #${seriesId} 가 사라졌습니다.`,
			embeds: [],
			components: [],
		});
		return;
	}
	if (series.status !== "IN_PROGRESS") {
		await interaction.editReply({
			content: `❌ 시리즈 #${seriesId} 가 이미 ${series.status} 상태입니다.`,
			embeds: [],
			components: [],
		});
		return;
	}

	const games = await listGamesInSeries(seriesId);
	const wins = await countSeriesWins(seriesId);

	if (result === "CANCEL") {
		await cancelSeries(seriesId);
	} else {
		await completeSeries(seriesId, result);
	}

	await recordAudit({
		operatorId: interaction.user.id,
		action: "series.early_complete",
		targetType: "series",
		targetId: String(seriesId),
		payload: {
			result,
			gamesAtEnd: games.length,
			winsAtEnd: wins,
			originalStatus: series.status,
		},
	});

	void notify("dashboard");
	void notify(`series:${seriesId}`);

	const finalLabel = result === "CANCEL" ? "CANCELLED" : `COMPLETED (${result} 승)`;
	await interaction.editReply({
		content: `✅ 시리즈 #${seriesId} 조기 종료 완료 — ${finalLabel}. 게임 ${games.length}경기 / 스코어 ${wins.team1}:${wins.team2} 보존됨.`,
		embeds: [],
		components: [],
	});
}
