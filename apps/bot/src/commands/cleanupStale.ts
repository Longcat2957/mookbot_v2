import {
	ActionRowBuilder,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	type ChatInputCommandInteraction,
	EmbedBuilder,
	SlashCommandBuilder,
} from "discord.js";
import { db } from "@mookbot/core";
import { requireOperator } from "../utils/operator.js";

const {
	listStaleOpenSeries,
	listStaleOpenRecruitments,
	deleteSeriesPhysical,
	deleteRecruitment,
	inspectSeriesForDelete,
	recordAudit,
} = db;

const DEFAULT_DAYS = 7;

export const data = new SlashCommandBuilder()
	.setName("오래된내전정리")
	.setDescription("[운영자] 오래 방치된 OPEN 모집 / IN_PROGRESS 시리즈 정리")
	.addIntegerOption((o) =>
		o
			.setName("days")
			.setDescription(`기준 일수 (기본 ${DEFAULT_DAYS})`)
			.setMinValue(1)
			.setMaxValue(365),
	);

interface PreviewItem {
	kind: "series" | "recruitment";
	id: number;
	ageDays: number;
	gamesCount?: number;
	skip?: string;
}

async function buildPreview(days: number): Promise<{
	items: PreviewItem[];
	now: number;
	cutoff: number;
}> {
	const now = Math.floor(Date.now() / 1000);
	const cutoff = now - days * 86400;

	const staleSeries = await listStaleOpenSeries(cutoff);
	const staleRecruits = await listStaleOpenRecruitments(cutoff);

	const items: PreviewItem[] = [];
	for (const s of staleSeries) {
		const summary = await inspectSeriesForDelete(s.id);
		const item: PreviewItem = {
			kind: "series",
			id: s.id,
			ageDays: Math.floor((now - s.started_at) / 86400),
			gamesCount: summary.gamesCount,
		};
		if (summary.gamesCount > 0) item.skip = "게임 기록 존재 — /시리즈강제삭제 필요";
		items.push(item);
	}
	for (const r of staleRecruits) {
		items.push({
			kind: "recruitment",
			id: r.id,
			ageDays: Math.floor((now - r.created_at) / 86400),
		});
	}
	return { items, now, cutoff };
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!(await requireOperator(interaction))) return;

	const days = interaction.options.getInteger("days") ?? DEFAULT_DAYS;
	await interaction.deferReply({ ephemeral: true });

	const { items } = await buildPreview(days);

	if (items.length === 0) {
		await interaction.editReply(`✅ ${days}일 이상 방치된 OPEN 모집 / IN_PROGRESS 시리즈 없음.`);
		return;
	}

	const deletable = items.filter((i) => !i.skip);
	const skipped = items.filter((i) => i.skip);

	const lines: string[] = [];
	if (deletable.length > 0) {
		lines.push("**삭제 대상**");
		for (const i of deletable.slice(0, 20)) {
			lines.push(
				`• ${i.kind === "series" ? "시리즈" : "모집"} #${i.id} (${i.ageDays}d` +
					(i.kind === "series" ? `, games=${i.gamesCount}` : "") +
					")",
			);
		}
		if (deletable.length > 20) lines.push(`…+${deletable.length - 20}`);
	}
	if (skipped.length > 0) {
		lines.push("");
		lines.push("**스킵 (수동 처리 필요)**");
		for (const i of skipped.slice(0, 10)) {
			lines.push(`• ${i.kind === "series" ? "시리즈" : "모집"} #${i.id} — ${i.skip}`);
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

	for (const i of deletable) {
		if (i.kind === "series") {
			await deleteSeriesPhysical(i.id);
			deletedSeries.push(i.id);
		} else {
			await deleteRecruitment(i.id);
			deletedRecruits.push(i.id);
		}
	}

	await recordAudit({
		operatorId: interaction.user.id,
		action: "cleanup.stale",
		targetType: "batch",
		payload: { days, deletedSeries, deletedRecruits },
	});

	await interaction.editReply({
		content: `✅ 정리 완료 — 시리즈 ${deletedSeries.length} · 모집 ${deletedRecruits.length} 삭제.`,
		embeds: [],
		components: [],
	});
}
