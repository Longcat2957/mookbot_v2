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
	.setDescription("[운영자] Riot 솔로랭크 기반 부계정/위장티어/패배패턴 검토 리포트")
	.addStringOption((o) =>
		o.setName("riot_id").setDescription("(선택) GameName#TagLine. user 보다 우선합니다."),
	)
	.addUserOption((o) => o.setName("user").setDescription("(선택) 등록된 사용자의 메인 계정"))
	.addIntegerOption((o) =>
		o
			.setName("sample")
			.setDescription("(선택) 최근 솔로랭크 조회 수. 기본 30, 최대 50")
			.setMinValue(1)
			.setMaxValue(50),
	)
	.addBooleanOption((o) => o.setName("refresh").setDescription("(선택) 24시간 캐시 무시 후 재조회"));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	if (!(await requireOperator(interaction))) return;

	const riotIdInput = interaction.options.getString("riot_id");
	const targetUser = interaction.options.getUser("user");
	const sample = clampSample(interaction.options.getInteger("sample") ?? 30);
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
	const embed = new EmbedBuilder()
		.setTitle(title)
		.setColor(colorFor(overall.level))
		.setDescription(
			[
				`종합 위험도: **${overall.score} (${labelRisk(overall.level)})**`,
				`운영 권고: **${labelRecommendation(report.recommendation)}**`,
				`신뢰도: **${report.sample.confidence}** · 표본: **${report.sample.analyzedMatches}/${report.sample.soloRankedMatches}**`,
				cached ? "_24시간 캐시 사용_" : "_신규 조회_",
			].join("\n"),
		);

	embed.addFields(
		{
			name: "프로필",
			value: [
				`랭크: ${report.profile.currentSoloRank ?? "UNRANKED"}`,
				`레벨: ${report.identity.summonerLevel ?? "?"}`,
				`최근 승률: ${report.profile.recentWinRate == null ? "-" : pct(report.profile.recentWinRate)}`,
			].join("\n"),
			inline: true,
		},
		{
			name: "세부 점수",
			value: [
				`부계정 가능성: ${report.scores.smurfRisk.score}`,
				`티어 불일치: ${report.scores.rankMismatchRisk.score}`,
				`패배 패턴: ${report.scores.derankOrThrowRisk.score}`,
				`포지션 변동: ${report.scores.roleMismatchRisk.score}`,
				`데이터 품질: ${report.scores.dataQualityRisk.score}`,
			].join("\n"),
			inline: true,
		},
	);

	const roles = report.profile.mainRoles
		.slice(0, 5)
		.map((role) => `${role.role} ${role.games}G (${pct(role.rate)})`)
		.join("\n");
	const champions = report.profile.mainChampions
		.slice(0, 5)
		.map((champ) => `${champ.champion} ${champ.games}G ${pct(champ.winRate)}`)
		.join("\n");
	embed.addFields(
		{ name: "포지션", value: roles || "_표본 없음_", inline: true },
		{ name: "챔피언", value: champions || "_표본 없음_", inline: true },
	);

	const evidence = report.evidence
		.slice(0, 6)
		.map(
			(item) =>
				`• ${item.value}${item.threshold ? ` / 기준 ${item.threshold}` : ""} — ${item.description}`,
		)
		.join("\n");
	embed.addFields({ name: "근거", value: evidence || "_특이 신호 없음_" });
	embed.setFooter({ text: "Riot API 기반 확률적 검토 보조. 고의성/대리/계정 소유자 확정 불가." });
	return embed;
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
	if (value === "HIGH") return "높음";
	if (value === "MEDIUM") return "중간";
	return "낮음";
}

function labelRecommendation(value: screening.Recommendation): string {
	if (value === "REJECT_OR_INTERVIEW") return "추가 인증/인터뷰";
	if (value === "MANUAL_REVIEW") return "수동 검토";
	return "통과 가능";
}

function colorFor(value: screening.RiskLevel): number {
	if (value === "HIGH") return 0xef4444;
	if (value === "MEDIUM") return 0xf59e0b;
	return 0x22c55e;
}
