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
import { requireOperator } from "../utils/operator.js";

const {
	listStaleOpenSeries,
	listStaleOpenRecruitments,
	listStaleOpenAuctionRecruitments,
	listStaleOpenAuctionTournaments,
	deleteSeriesPhysical,
	deleteRecruitment,
	deleteAuctionRecruitment,
	softDeleteAuctionTournament,
	inspectSeriesForDelete,
	listAuctionMatches,
	listAuctionTeams,
	recordAudit,
} = db;

const DEFAULT_DAYS = 7;

export const data = new SlashCommandBuilder()
	.setName("오래된내전정리")
	.setDescription("[운영자] 오래 방치된 모집/시리즈/경매 정리")
	.addIntegerOption((o) =>
		o
			.setName("days")
			.setDescription(`기준 일수 (기본 ${DEFAULT_DAYS})`)
			.setMinValue(1)
			.setMaxValue(365),
	);

type ItemKind = "series" | "recruitment" | "auction-recruitment" | "auction-tournament";

interface PreviewItem {
	kind: ItemKind;
	id: number;
	ageDays: number;
	gamesCount?: number;
	teamsCount?: number;
	status?: string;
	skip?: string;
}

async function buildPreview(days: number): Promise<{
	items: PreviewItem[];
	now: number;
	cutoff: number;
}> {
	const now = Math.floor(Date.now() / 1000);
	const cutoff = now - days * 86400;

	const [staleSeries, staleRecruits, staleAuctionRecruits, staleAuctionTournaments] =
		await Promise.all([
			listStaleOpenSeries(cutoff),
			listStaleOpenRecruitments(cutoff),
			listStaleOpenAuctionRecruitments(cutoff),
			listStaleOpenAuctionTournaments(cutoff),
		]);

	const items: PreviewItem[] = [];
	for (const s of staleSeries) {
		const summary = await inspectSeriesForDelete(s.id);
		const item: PreviewItem = {
			kind: "series",
			id: s.id,
			ageDays: Math.floor((now - s.started_at) / 86400),
			gamesCount: summary.gamesCount,
		};
		if (summary.gamesCount > 0) item.skip = "게임 기록 존재 — /내전강제삭제 필요";
		items.push(item);
	}
	for (const r of staleRecruits) {
		items.push({
			kind: "recruitment",
			id: r.id,
			ageDays: Math.floor((now - r.created_at) / 86400),
		});
	}
	for (const ar of staleAuctionRecruits) {
		items.push({
			kind: "auction-recruitment",
			id: ar.id,
			ageDays: Math.floor((now - ar.created_at) / 86400),
			status: ar.status,
		});
	}
	for (const at of staleAuctionTournaments) {
		// 매치/팀 기록 있으면 skip — 운영자가 /경매강제삭제 로 명시 처리
		const [matches, teams] = await Promise.all([
			listAuctionMatches(at.id),
			listAuctionTeams(at.id),
		]);
		const item: PreviewItem = {
			kind: "auction-tournament",
			id: at.id,
			ageDays: Math.floor((now - at.started_at) / 86400),
			status: at.status,
			teamsCount: teams.length,
		};
		if (matches.length > 0) {
			item.skip = `매치 ${matches.length}건 존재 — /경매강제삭제 필요`;
		}
		items.push(item);
	}
	return { items, now, cutoff };
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!(await requireOperator(interaction))) return;

	const days = interaction.options.getInteger("days") ?? DEFAULT_DAYS;
	await interaction.deferReply({ ephemeral: true });

	const { items } = await buildPreview(days);

	if (items.length === 0) {
		await interaction.editReply(`✅ ${days}일 이상 방치된 모집/시리즈/경매 없음.`);
		return;
	}

	const deletable = items.filter((i) => !i.skip);
	const skipped = items.filter((i) => i.skip);

	const labelFor = (k: ItemKind): string => {
		if (k === "series") return "시리즈";
		if (k === "recruitment") return "모집";
		if (k === "auction-recruitment") return "경매모집";
		return "경매토너";
	};

	const lines: string[] = [];
	if (deletable.length > 0) {
		lines.push("**삭제 대상**");
		for (const i of deletable.slice(0, 20)) {
			const extra =
				i.kind === "series"
					? `, games=${i.gamesCount}`
					: i.kind === "auction-tournament"
						? `, ${i.status}, teams=${i.teamsCount ?? 0}`
						: i.kind === "auction-recruitment"
							? `, ${i.status}`
							: "";
			lines.push(`• ${labelFor(i.kind)} #${i.id} (${i.ageDays}d${extra})`);
		}
		if (deletable.length > 20) lines.push(`…+${deletable.length - 20}`);
	}
	if (skipped.length > 0) {
		lines.push("");
		lines.push("**스킵 (수동 처리 필요)**");
		for (const i of skipped.slice(0, 10)) {
			lines.push(`• ${labelFor(i.kind)} #${i.id} — ${i.skip}`);
		}
	}

	const embed = new EmbedBuilder()
		.setTitle(`⚠️ 오래된 내전 정리 미리보기 (${days}일 이상)`)
		.setColor(0xe8b339)
		.setDescription(lines.join("\n"))
		.setFooter({ text: `삭제 ${deletable.length} · 스킵 ${skipped.length}` });

	const confirmId = `admin:confirm:cleanup_stale:${days}`;
	const cancelId = `admin:cancel:cleanup_stale:${days}`;
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(confirmId)
			.setLabel(`확정 삭제 (${deletable.length}건)`)
			.setStyle(ButtonStyle.Danger)
			.setDisabled(deletable.length === 0),
		new ButtonBuilder().setCustomId(cancelId).setLabel("취소").setStyle(ButtonStyle.Secondary),
	);

	await interaction.editReply({ embeds: [embed], components: [row] });
}

export async function handleButton(interaction: ButtonInteraction): Promise<void> {
	const parts = interaction.customId.split(":");
	if (parts[2] !== "cleanup_stale") return;

	if (!(await requireOperator(interaction))) return;

	if (parts[1] === "cancel") {
		await interaction.update({ content: "취소되었습니다.", embeds: [], components: [] });
		return;
	}

	const days = Number(parts[3]);
	await interaction.deferUpdate();

	const { items } = await buildPreview(days);
	const deletable = items.filter((i) => !i.skip);

	const deletedSeries: number[] = [];
	const deletedRecruits: number[] = [];
	const deletedAuctionRecruits: number[] = [];
	const deletedAuctionTournaments: number[] = [];

	for (const i of deletable) {
		if (i.kind === "series") {
			await deleteSeriesPhysical(i.id);
			deletedSeries.push(i.id);
		} else if (i.kind === "recruitment") {
			await deleteRecruitment(i.id);
			deletedRecruits.push(i.id);
		} else if (i.kind === "auction-recruitment") {
			await deleteAuctionRecruitment(i.id);
			deletedAuctionRecruits.push(i.id);
		} else {
			// auction-tournament: 매치 0개인 경우만 도달 (skip 가드). soft-delete.
			await softDeleteAuctionTournament(i.id);
			deletedAuctionTournaments.push(i.id);
		}
	}

	await recordAudit({
		operatorId: interaction.user.id,
		action: "cleanup.stale",
		targetType: "batch",
		payload: {
			days,
			deletedSeries,
			deletedRecruits,
			deletedAuctionRecruits,
			deletedAuctionTournaments,
		},
	});

	await interaction.editReply({
		content:
			`✅ 정리 완료 — 시리즈 ${deletedSeries.length} · 모집 ${deletedRecruits.length} · ` +
			`경매모집 ${deletedAuctionRecruits.length} · 경매토너 ${deletedAuctionTournaments.length} 삭제.`,
		embeds: [],
		components: [],
	});
}
