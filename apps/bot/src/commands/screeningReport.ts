import { db, riot, screening } from "@mookbot/core";
import {
	type ChatInputCommandInteraction,
	EmbedBuilder,
	SlashCommandBuilder,
	type User,
} from "discord.js";
import { requireOperator } from "../utils/operator.js";

const CACHE_TTL_MS = 24 * 60 * 60_000;

type CachedReport = {
	fetchedAt: number;
	report: screening.ScreeningReport;
};

export const data = new SlashCommandBuilder()
	.setName("전적검토")
	.setDescription("[운영자] Riot 솔로랭크 기반 부계정/위장티어/패배패턴/계정일관성 검토 리포트")
	.addStringOption((o) =>
		o.setName("riot_id").setDescription("(선택) GameName#TagLine. user 보다 우선합니다."),
	)
	.addUserOption((o) => o.setName("user").setDescription("(선택) 등록된 사용자의 메인 계정"))
	.addIntegerOption((o) =>
		o
			.setName("sample")
			.setDescription("(선택) 최근 솔로랭크 조회 수. 기본 50, 최대 50")
			.setMinValue(1)
			.setMaxValue(50),
	)
	.addBooleanOption((o) => o.setName("refresh").setDescription("(선택) 24시간 캐시 무시 후 재조회"));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!(await requireOperator(interaction))) return;

	const riotIdInput = interaction.options.getString("riot_id");
	const targetUser = interaction.options.getUser("user");
	const sample = clampSample(interaction.options.getInteger("sample") ?? 50);
	const refresh = interaction.options.getBoolean("refresh") ?? false;

	await interaction.deferReply({ ephemeral: true });
	await interaction.editReply("🔎 Riot API 기반 검토 리포트 생성 중...");

	try {
		const target = await resolveTarget(interaction, riotIdInput, targetUser);
		const result = await getOrGenerateReport({ ...target, sample, refresh });

		await db.recordAudit({
			operatorId: interaction.user.id,
			action: "screening.report.viewed",
			targetType: target.targetType,
			targetId: target.targetId,
			payload: {
				riotId: `${target.gameName}#${target.tagLine}`,
				region: "ASIA",
				platform: "KR",
				sample,
				cached: result.cached,
				stale: result.stale,
				source: "discord-command",
			},
		});

		await interaction.editReply({
			content: result.stale
				? "⚠️ Riot API 갱신 실패로 이전 캐시를 표시합니다."
				: "확정 판정이 아닌 운영 검토용 신호입니다.",
			embeds: [buildReportEmbed(result.report, result.cached)],
		});
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		await interaction.editReply(`❌ 전적 검토 실패: ${msg}`);
	}
}

async function resolveTarget(
	interaction: ChatInputCommandInteraction,
	riotIdInput: string | null,
	targetUser: User | null,
): Promise<{
	gameName: string;
	tagLine: string;
	targetType: "riot_id" | "user";
	targetId: string;
}> {
	if (riotIdInput) {
		const [gameName, tagLine] = riot.parseRiotId(riotIdInput.trim());
		return {
			gameName,
			tagLine,
			targetType: "riot_id",
			targetId: `${gameName}#${tagLine}`,
		};
	}

	const user = targetUser ?? interaction.user;
	const main = await db.getMainRiotAccount(user.id);
	if (!main) {
		throw new Error(`${user.displayName} 님은 라이엇 ID가 연결되지 않았습니다.`);
	}
	return {
		gameName: main.game_name,
		tagLine: main.tag_line,
		targetType: "user",
		targetId: user.id,
	};
}

async function getOrGenerateReport(input: {
	gameName: string;
	tagLine: string;
	sample: number;
	refresh: boolean;
}): Promise<{
	cached: boolean;
	stale: boolean;
	report: screening.ScreeningReport;
}> {
	const key = cacheKey(input.gameName, input.tagLine, input.sample);
	const cached = await readCachedReport(key);
	if (cached && !input.refresh && cached.fetchedAt + CACHE_TTL_MS > Date.now()) {
		return { cached: true, stale: false, report: cached.report };
	}

	try {
		const report = await screening.generateLolScreeningReport({
			gameName: input.gameName,
			tagLine: input.tagLine,
			region: "ASIA",
			platform: "KR",
			sample: input.sample,
		});
		await db.setKv(key, JSON.stringify({ fetchedAt: Date.now(), report }), "screening-report");
		return { cached: false, stale: false, report };
	} catch (err) {
		if (cached) return { cached: true, stale: true, report: cached.report };
		throw err;
	}
}

async function readCachedReport(key: string): Promise<CachedReport | null> {
	const raw = await db.getKv(key);
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as CachedReport;
		if (!parsed || typeof parsed.fetchedAt !== "number" || !parsed.report) return null;
		return parsed;
	} catch {
		return null;
	}
}

function buildReportEmbed(report: screening.ScreeningReport, cached: boolean): EmbedBuilder {
	const overall = report.scores.overallReviewRisk;
	const title = `🧪 ${report.identity.gameName}#${report.identity.tagLine}`;
	const status = `${cached ? "캐시" : "신규"} · 신뢰도 ${confidenceDots(report.sample.confidence)} · 표본 ${report.sample.analyzedMatches}/${report.sample.soloRankedMatches}`;
	const overallLine = `🟦 종합 **${overall.score}/100** ${labelRisk(overall.level)}  →  ${labelRecommendation(report.recommendation)}`;
	const headline = report.summary.headline ? `📌 ${report.summary.headline}` : "";
	const reasonsLine =
		report.summary.primaryReasons.length > 0
			? `주근거: ${report.summary.primaryReasons.slice(0, 3).join(" · ")}`
			: "";
	const description = [status, "", overallLine, headline, reasonsLine].filter(Boolean).join("\n");

	const embed = new EmbedBuilder()
		.setTitle(title)
		.setColor(colorFor(overall.level))
		.setDescription(description);

	embed.addFields(
		{ name: "📊 카테고리 위험도", value: buildCategoryBars(report) },
		{ name: "👤 프로필 / 표본", value: buildProfileBlock(report), inline: false },
		{ name: "🎯 분당 평균", value: buildMetricsBlock(report), inline: false },
		{ name: "⚖️ 승패 갈림", value: buildWinLossSplit(report), inline: false },
		{
			name: "🧭 포지션",
			value: buildRolesBlock(report) || "_표본 없음_",
			inline: true,
		},
		{
			name: "🐉 챔피언 풀",
			value: buildChampionsBlock(report) || "_표본 없음_",
			inline: true,
		},
		{ name: "📈 최근 W/L (좌=최근)", value: buildSequenceBlock(report) },
	);

	const timeHistogram = buildTimeHistogramBlock(report);
	if (timeHistogram) {
		embed.addFields({ name: "🕒 시간대 분포 (KST)", value: timeHistogram });
	}
	const variabilityBlock = buildVariabilityBlock(report);
	if (variabilityBlock) {
		embed.addFields({ name: "📉 변동성", value: variabilityBlock });
	}

	embed.addFields({ name: "🔎 신호", value: buildEvidenceBlock(report) });

	embed.setFooter({
		text: "임계: 0-39 낮음 / 40-69 중간 / 70+ 높음 · 확정 판정 아님",
	});
	return embed;
}

function buildCategoryBars(report: screening.ScreeningReport): string {
	const rows: Array<{ label: string; score: number; level: screening.RiskLevel }> = [
		{
			label: "부계정    ",
			score: report.scores.smurfRisk.score,
			level: report.scores.smurfRisk.level,
		},
		{
			label: "티어불일치",
			score: report.scores.rankMismatchRisk.score,
			level: report.scores.rankMismatchRisk.level,
		},
		{
			label: "패배패턴  ",
			score: report.scores.derankOrThrowRisk.score,
			level: report.scores.derankOrThrowRisk.level,
		},
		{
			label: "계정일관성",
			score: report.scores.accountConsistencyRisk.score,
			level: report.scores.accountConsistencyRisk.level,
		},
		{
			label: "포지션    ",
			score: report.scores.roleMismatchRisk.score,
			level: report.scores.roleMismatchRisk.level,
		},
		{
			label: "데이터품질",
			score: report.scores.dataQualityRisk.score,
			level: report.scores.dataQualityRisk.level,
		},
	];
	const lines = rows.map(
		(r) => `${r.label} ${bar(r.score)} ${pad3(r.score)} ${labelRiskShort(r.level)}`,
	);
	return codeBlock(lines.join("\n"));
}

function buildProfileBlock(report: screening.ScreeningReport): string {
	const rank = report.profile.currentSoloRank ?? "UNRANKED";
	const seasonW = report.profile.soloRankedWins;
	const seasonL = report.profile.soloRankedLosses;
	const seasonLine =
		seasonW != null && seasonL != null && seasonW + seasonL > 0
			? `시즌 ${seasonW}W-${seasonL}L · ${pct(seasonW / (seasonW + seasonL))}`
			: "시즌 데이터 없음";
	const lvl = report.identity.summonerLevel ?? "?";
	const recentW = report.recentSequence.filter((s) => s === "W").length;
	const recentL = report.recentSequence.length - recentW;
	const winRate = report.profile.recentWinRate;
	const dr = report.sample.dateRange;
	const range = dr.from && dr.to ? `${formatDate(dr.from)} ~ ${formatDate(dr.to)}` : "-";

	const lines = [
		`랭크   ${rank}  (${seasonLine})`,
		`레벨   ${lvl}`,
		`표본   ${report.sample.analyzedMatches}판 (${range})`,
		`최근   ${recentW}W-${recentL}L · ${winRate == null ? "-" : pct(winRate)}`,
	];
	return codeBlock(lines.join("\n"));
}

function buildMetricsBlock(report: screening.ScreeningReport): string {
	const m = report.metrics;
	const header = "          값        벤치    판정";
	const lines = [
		header,
		row("KDA  ", round(m.averageKda, 2).toFixed(2), "3.50", arrow(m.averageKda, 3.5)),
		row("DPM  ", Math.round(m.averageDpm).toString(), "650 ", arrow(m.averageDpm, 650)),
		row("GPM  ", Math.round(m.averageGpm).toString(), "400 ", arrow(m.averageGpm, 400)),
		row("CS/M ", round(m.averageCsPerMin, 1).toFixed(1), "7.0 ", arrow(m.averageCsPerMin, 7.0)),
		row(
			"시야/M",
			round(m.averageVisionPerMin, 2).toFixed(2),
			"1.50",
			arrow(m.averageVisionPerMin, 1.5),
		),
		row(
			"데스/M",
			round(m.averageDeathsPerMin, 2).toFixed(2),
			"0.20",
			arrowInverse(m.averageDeathsPerMin, 0.2),
		),
	];
	return codeBlock(lines.join("\n"));
}

function buildWinLossSplit(report: screening.ScreeningReport): string {
	const m = report.metrics;
	const header = "         승        패        Δ";
	const lines = [
		header,
		row(
			"KDA  ",
			round(m.winKda, 2).toFixed(2),
			round(m.lossKda, 2).toFixed(2),
			signed(m.winKda - m.lossKda, 2),
		),
		row(
			"데스 ",
			round(m.winDeaths, 1).toFixed(1),
			round(m.lossDeaths, 1).toFixed(1),
			signed(m.winDeaths - m.lossDeaths, 1),
		),
		row(
			"DPM  ",
			Math.round(m.winDpm).toString(),
			Math.round(m.lossDpm).toString(),
			signed(m.winDpm - m.lossDpm, 0),
		),
	];
	return codeBlock(lines.join("\n"));
}

function buildRolesBlock(report: screening.ScreeningReport): string {
	return report.profile.mainRoles
		.slice(0, 5)
		.map((r) => `${koLane(r.role)} ${r.games}판 ${pct(r.rate)}`)
		.join("\n");
}

function buildChampionsBlock(report: screening.ScreeningReport): string {
	const meta = `유니크 ${report.profile.championPool}챔 · Top1 ${pct(report.profile.top1Concentration)}`;
	const list = report.profile.mainChampions
		.slice(0, 5)
		.map((c) => `${c.champion} ${c.games}판 ${pct(c.winRate)}`)
		.join("\n");
	return `${list}\n_${meta}_`;
}

function buildSequenceBlock(report: screening.ScreeningReport): string {
	const seq = report.recentSequence.map((s) => (s === "W" ? "●" : "○")).join("");
	const stats = `연승 ${report.streaks.longestWinStreak} · 연패 ${report.streaks.longestLossStreak}`;
	return `\`\`\`\n${seq || "(표본 없음)"}\n\`\`\`\n● 승 / ○ 패 · ${stats}`;
}

function buildTimeHistogramBlock(report: screening.ScreeningReport): string | null {
	const hist = report.timeOfDayHistogram;
	const total = hist.reduce((s, n) => s + n, 0);
	if (total < 10) return null;
	const groups: Array<{ label: string; count: number }> = [];
	for (let i = 0; i < 24; i += 3) {
		const slice = hist.slice(i, i + 3);
		const count = slice.reduce((s, n) => s + n, 0);
		groups.push({
			label: `${pad2(i)}-${pad2(i + 2)}`,
			count,
		});
	}
	const max = Math.max(1, ...groups.map((g) => g.count));
	const lines = groups.map((g) => {
		const filled = Math.round((g.count / max) * 10);
		const bar = "█".repeat(filled) + "░".repeat(10 - filled);
		return `${g.label}  ${bar} ${pad3(g.count)}`;
	});
	return codeBlock(lines.join("\n"));
}

function buildVariabilityBlock(report: screening.ScreeningReport): string | null {
	if (report.sample.analyzedMatches < 20) return null;
	const v = report.variability;
	const lines = [
		"        μ        σ        CV",
		row(
			"KDA  ",
			round(v.kdaMean, 2).toFixed(2),
			round(v.kdaStdev, 2).toFixed(2),
			round(v.kdaCv, 2).toFixed(2),
		) + cvFlag(v.kdaCv, 0.85),
		row(
			"DPM  ",
			Math.round(v.dpmMean).toString(),
			Math.round(v.dpmStdev).toString(),
			round(v.dpmCv, 2).toFixed(2),
		) + cvFlag(v.dpmCv, 0.45),
	];
	return codeBlock(lines.join("\n"));
}

function cvFlag(cv: number, threshold: number): string {
	return cv >= threshold ? " ⚠" : "";
}

function pad2(n: number): string {
	return String(n).padStart(2, "0");
}

function buildEvidenceBlock(report: screening.ScreeningReport): string {
	const top = [...report.evidence]
		.sort((a, b) => b.weight - a.weight)
		.slice(0, 8)
		.map(
			(e) =>
				`[${categoryLabel(e.category)}] ${e.metric} ${e.value}${e.threshold ? ` (${e.threshold})` : ""} +${e.weight}`,
		);
	if (top.length === 0) return "_특이 신호 없음_";
	return codeBlock(top.join("\n"));
}

function categoryLabel(category: string): string {
	switch (category) {
		case "smurf":
			return "부계정";
		case "rankMismatch":
			return "티어";
		case "derankOrThrow":
			return "패턴";
		case "accountConsistency":
			return "일관성";
		case "roleMismatch":
			return "포지션";
		case "dataQuality":
			return "품질";
		default:
			return category;
	}
}

function koLane(lane: string): string {
	switch (lane) {
		case "TOP":
			return "탑    ";
		case "JUNGLE":
			return "정글  ";
		case "MIDDLE":
			return "미드  ";
		case "BOTTOM":
			return "원딜  ";
		case "UTILITY":
			return "서폿  ";
		default:
			return lane;
	}
}

function bar(score: number): string {
	const filled = Math.max(0, Math.min(10, Math.round(score / 10)));
	return "█".repeat(filled) + "░".repeat(10 - filled);
}

function pad3(n: number): string {
	return String(n).padStart(3, " ");
}

function labelRiskShort(level: screening.RiskLevel): string {
	if (level === "HIGH") return "HIGH";
	if (level === "MEDIUM") return "MED ";
	return "LOW ";
}

function row(label: string, a: string, b: string, c: string): string {
	return `${label} ${a.padStart(8, " ")}  ${b.padStart(7, " ")}  ${c.padStart(6, " ")}`;
}

function arrow(value: number, bench: number): string {
	if (!Number.isFinite(value) || value === 0) return "  -  ";
	if (value >= bench * 1.15) return "↑↑";
	if (value >= bench) return " ↑";
	if (value >= bench * 0.85) return " ·";
	return " ↓";
}

function arrowInverse(value: number, bench: number): string {
	if (!Number.isFinite(value) || value === 0) return "  -  ";
	if (value <= bench * 0.6) return "↑↑";
	if (value <= bench * 0.85) return " ↑";
	if (value <= bench * 1.15) return " ·";
	return " ↓";
}

function signed(value: number, digits: number): string {
	if (!Number.isFinite(value)) return "-";
	const sign = value > 0 ? "+" : value < 0 ? "" : "";
	return `${sign}${round(value, digits).toFixed(digits)}`;
}

function codeBlock(content: string): string {
	return `\`\`\`\n${content}\n\`\`\``;
}

function formatDate(iso: string): string {
	const d = new Date(iso);
	const yyyy = d.getUTCFullYear();
	const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
	const dd = String(d.getUTCDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}`;
}

function confidenceDots(c: screening.Confidence): string {
	if (c === "HIGH") return "●●●";
	if (c === "MEDIUM") return "●●○";
	return "●○○";
}

function round(value: number, digits: number): number {
	if (!Number.isFinite(value)) return 0;
	const factor = 10 ** digits;
	return Math.round(value * factor) / factor;
}

function cacheKey(gameName: string, tagLine: string, sample: number): string {
	const riotId = `${gameName}#${tagLine}`.toLocaleLowerCase("ko-KR");
	return `screening:lol:ASIA:KR:${sample}:${encodeURIComponent(riotId)}`;
}

function clampSample(value: number): number {
	return Math.max(1, Math.min(50, Math.trunc(value)));
}

function pct(value: number): string {
	return `${Math.round(value * 100)}%`;
}

function labelRisk(value: screening.RiskLevel): string {
	if (value === "HIGH") return "**HIGH**";
	if (value === "MEDIUM") return "**MEDIUM**";
	return "**LOW**";
}

function labelRecommendation(value: screening.Recommendation): string {
	if (value === "REJECT_OR_INTERVIEW") return "🟥 추가 인증/인터뷰";
	if (value === "MANUAL_REVIEW") return "🟧 수동 검토";
	return "🟩 통과 가능";
}

function colorFor(value: screening.RiskLevel): number {
	if (value === "HIGH") return 0xef4444;
	if (value === "MEDIUM") return 0xf59e0b;
	return 0x22c55e;
}
