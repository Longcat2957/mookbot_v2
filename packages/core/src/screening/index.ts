import { getRiotClient, type Platform, type Region } from "../riot/client.js";
import type { LeagueEntryDto, MatchDto, MatchParticipantDto } from "../riot/types.js";
import {
	type BenchmarkMetric,
	type BenchmarkRole,
	getBenchmarkRow,
	normalizeBenchmarkRole,
} from "./benchmarks.js";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type Confidence = "LOW" | "MEDIUM" | "HIGH";
export type Recommendation = "AUTO_PASS" | "MANUAL_REVIEW" | "REJECT_OR_INTERVIEW";

export interface RiskScore {
	score: number;
	level: RiskLevel;
	reasons: string[];
}

export interface Evidence {
	category: string;
	metric: string;
	value: number | string;
	threshold?: number | string;
	weight: number;
	description: string;
}

export interface ScreeningReport {
	version: "0.22.0";
	generatedAt: string;
	identity: {
		gameName: string;
		tagLine: string;
		puuid: string;
		region: Region;
		platform: Platform;
		summonerLevel?: number;
	};
	sample: {
		requestedMatches: number;
		soloRankedMatches: number;
		analyzedMatches: number;
		excludedMatches: number;
		dateRange: { from: string | null; to: string | null };
		confidence: Confidence;
	};
	profile: {
		currentSoloRank: string | null;
		soloRankedWins: number | null;
		soloRankedLosses: number | null;
		recentWinRate: number | null;
		mainRoles: Array<{ role: string; games: number; rate: number }>;
		mainChampions: Array<{ champion: string; games: number; wins: number; winRate: number }>;
		championPool: number;
		top1Concentration: number;
	};
	metrics: {
		averageKda: number;
		averageDpm: number;
		averageGpm: number;
		averageCsPerMin: number;
		averageVisionPerMin: number;
		averageDeathsPerMin: number;
		winKda: number;
		lossKda: number;
		winDeaths: number;
		lossDeaths: number;
		winDpm: number;
		lossDpm: number;
	};
	benchmarks: {
		tier: string | null;
		roleComparisons: Array<{
			role: string;
			games: number;
			kda: MetricComparison | null;
			kills: MetricComparison | null;
			deaths: MetricComparison | null;
			csm: MetricComparison | null;
		}>;
	};
	streaks: {
		longestWinStreak: number;
		longestLossStreak: number;
	};
	recentSequence: Array<"W" | "L">;
	variability: {
		kdaMean: number;
		kdaStdev: number;
		kdaCv: number;
		dpmMean: number;
		dpmStdev: number;
		dpmCv: number;
	};
	timeOfDayHistogram: number[];
	scores: {
		accountTierMismatchRisk: RiskScore;
		/** @deprecated Use accountTierMismatchRisk. Kept for cached reports and old clients. */
		smurfRisk: RiskScore;
		/** @deprecated Use accountTierMismatchRisk. Kept for cached reports and old clients. */
		rankMismatchRisk: RiskScore;
		derankOrThrowRisk: RiskScore;
		accountConsistencyRisk: RiskScore;
		roleMismatchRisk: RiskScore;
		dataQualityRisk: RiskScore;
		overallReviewRisk: RiskScore;
	};
	evidence: Evidence[];
	summary: {
		headline: string;
		primaryReasons: string[];
	};
	recommendation: Recommendation;
}

interface GenerateInput {
	gameName: string;
	tagLine: string;
	region?: Region;
	platform?: Platform;
	sample?: number;
}

interface MatchSummary {
	matchId: string;
	playedAt: number;
	lane: string | null;
	side: "BLUE" | "RED" | null;
	champion: string;
	win: boolean;
	kills: number;
	deaths: number;
	assists: number;
	minutes: number;
	csPerMin: number;
	goldPerMin: number;
	damagePerMin: number;
	visionPerMin: number;
	deathsPerMin: number;
	kda: number;
}

interface MetricComparison {
	value: number;
	baseline: number;
	deltaPct: number;
}

const SOLO_QUEUE_ID = 420;
const MATCH_DETAIL_CONCURRENCY = 5;
const MIN_ANALYZABLE_SECONDS = 300;
const DAY_MS = 24 * 60 * 60 * 1000;
const VALID_LANES = new Set(["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]);
const CONSISTENCY_MIN_SAMPLE = 20;

export async function generateLolScreeningReport(input: GenerateInput): Promise<ScreeningReport> {
	const region = input.region ?? "ASIA";
	const platform = input.platform ?? "KR";
	const requestedMatches = clampInt(input.sample ?? 50, 1, 50);
	const client = getRiotClient();

	const account = await client.getAccountByRiotId(input.gameName, input.tagLine, region);
	const [summoner, leagueEntries, matchIds] = await Promise.all([
		client.getSummonerByPuuid(account.puuid, platform),
		client.getLeagueEntries(account.puuid, platform),
		client.getMatchIds(account.puuid, requestedMatches, region, { queue: SOLO_QUEUE_ID }),
	]);
	const matches = await mapConcurrent(matchIds, MATCH_DETAIL_CONCURRENCY, (matchId) =>
		client.getMatch(matchId, region),
	);
	const summaries = summarizeMatches(matches, account.puuid);
	summaries.sort((a, b) => b.playedAt - a.playedAt);
	const excludedMatches = matchIds.length - summaries.length;
	const soloEntry = leagueEntries.find((entry) => entry.queueType === "RANKED_SOLO_5x5");
	const evidence: Evidence[] = [];

	const sampleConfidence = confidenceFor(summaries.length);
	const profile = buildProfile(summaries, soloEntry);
	const metrics = buildMetrics(summaries);
	const streaks = buildStreaks(summaries);
	const recentSequence = summaries.slice(0, 20).map((s) => (s.win ? "W" : "L") as "W" | "L");
	const variability = buildVariability(summaries);
	const timeOfDayHistogram = buildTimeOfDayHistogram(summaries);

	const rankedGames = soloEntry ? soloEntry.wins + soloEntry.losses : null;
	const benchmarkTier = soloEntry?.tier ?? null;
	const benchmarks = buildBenchmarkComparisons(summaries, benchmarkTier);
	const accountTierMismatchRisk = scoreAccountTierMismatchRisk({
		summonerLevel: summoner.summonerLevel,
		rankedGames,
		summaries,
		profile,
		metrics,
		benchmarks,
		tier: benchmarkTier,
		evidence,
	});
	const smurfRisk = accountTierMismatchRisk;
	const rankMismatchRisk = accountTierMismatchRisk;
	const derankOrThrowRisk = scoreDerankOrThrowRisk({ summaries, metrics, benchmarks, evidence });
	const accountConsistencyRisk = scoreAccountConsistencyRisk({
		summaries,
		variability,
		profile,
		timeOfDayHistogram,
		evidence,
	});
	const roleMismatchRisk = scoreRoleMismatchRisk({ summaries, evidence });
	const dataQualityRisk = scoreDataQualityRisk({
		analyzedMatches: summaries.length,
		excludedMatches,
		totalMatches: matchIds.length,
		evidence,
	});
	const overallReviewRisk = scoreOverall({
		accountTierMismatchRisk,
		derankOrThrowRisk,
		accountConsistencyRisk,
		roleMismatchRisk,
		dataQualityRisk,
		confidence: sampleConfidence,
	});

	const recommendation = recommendationFor({
		overall: overallReviewRisk.score,
		consistency: accountConsistencyRisk.score,
		confidence: sampleConfidence,
		summonerLevel: summoner.summonerLevel,
		rankedGames,
	});

	const summary = buildSummary({
		overall: overallReviewRisk,
		accountTierMismatchRisk,
		derankOrThrowRisk,
		accountConsistencyRisk,
		recommendation,
	});

	return {
		version: "0.22.0",
		generatedAt: new Date().toISOString(),
		identity: {
			gameName: account.gameName,
			tagLine: account.tagLine,
			puuid: account.puuid,
			region,
			platform,
			summonerLevel: summoner.summonerLevel,
		},
		sample: {
			requestedMatches,
			soloRankedMatches: matchIds.length,
			analyzedMatches: summaries.length,
			excludedMatches,
			dateRange: dateRangeFor(summaries),
			confidence: sampleConfidence,
		},
		profile,
		metrics,
		benchmarks,
		streaks,
		recentSequence,
		variability,
		timeOfDayHistogram,
		scores: {
			accountTierMismatchRisk,
			smurfRisk,
			rankMismatchRisk,
			derankOrThrowRisk,
			accountConsistencyRisk,
			roleMismatchRisk,
			dataQualityRisk,
			overallReviewRisk,
		},
		evidence,
		summary,
		recommendation,
	};
}

function summarizeMatches(matches: MatchDto[], puuid: string): MatchSummary[] {
	const summaries: MatchSummary[] = [];
	for (const match of matches) {
		const participant = match.info.participants.find((p) => p.puuid === puuid);
		if (!participant) continue;
		const seconds = participant.timePlayed || match.info.gameDuration;
		if (!seconds || seconds < MIN_ANALYZABLE_SECONDS) continue;
		const minutes = seconds / 60;
		const lane = normalizeLane(participant);
		summaries.push({
			matchId: match.metadata.matchId,
			playedAt:
				match.info.gameEndTimestamp || match.info.gameStartTimestamp || match.info.gameCreation,
			lane,
			side: participant.teamId === 100 ? "BLUE" : participant.teamId === 200 ? "RED" : null,
			champion: participant.championName,
			win: participant.win,
			kills: participant.kills,
			deaths: participant.deaths,
			assists: participant.assists,
			minutes,
			csPerMin: (participant.totalMinionsKilled + participant.neutralMinionsKilled) / minutes,
			goldPerMin: participant.goldEarned / minutes,
			damagePerMin: participant.totalDamageDealtToChampions / minutes,
			visionPerMin: participant.visionScore / minutes,
			deathsPerMin: participant.deaths / minutes,
			kda:
				participant.deaths === 0
					? participant.kills + participant.assists
					: (participant.kills + participant.assists) / participant.deaths,
		});
	}
	return summaries;
}

function buildProfile(
	summaries: MatchSummary[],
	soloEntry: LeagueEntryDto | undefined,
): ScreeningReport["profile"] {
	const wins = summaries.filter((s) => s.win).length;
	const championCounts = topChampionCounts(summaries);
	const uniqueChampions = new Set(summaries.map((s) => s.champion)).size;
	const top1 = championCounts[0];
	const top1Concentration = summaries.length > 0 && top1 ? top1.games / summaries.length : 0;
	return {
		currentSoloRank: soloEntry
			? `${soloEntry.tier} ${soloEntry.rank} ${soloEntry.leaguePoints}LP`
			: null,
		soloRankedWins: soloEntry?.wins ?? null,
		soloRankedLosses: soloEntry?.losses ?? null,
		recentWinRate: summaries.length > 0 ? wins / summaries.length : null,
		mainRoles: topCounts(
			summaries.map((s) => s.lane).filter((lane): lane is string => lane !== null),
			summaries.length,
		).map(([role, games, rate]) => ({ role, games, rate })),
		mainChampions: championCounts,
		championPool: uniqueChampions,
		top1Concentration,
	};
}

function buildMetrics(summaries: MatchSummary[]): ScreeningReport["metrics"] {
	const wins = summaries.filter((s) => s.win);
	const losses = summaries.filter((s) => !s.win);
	return {
		averageKda: average(summaries.map((s) => s.kda)),
		averageDpm: average(summaries.map((s) => s.damagePerMin)),
		averageGpm: average(summaries.map((s) => s.goldPerMin)),
		averageCsPerMin: average(summaries.map((s) => s.csPerMin)),
		averageVisionPerMin: average(summaries.map((s) => s.visionPerMin)),
		averageDeathsPerMin: average(summaries.map((s) => s.deathsPerMin)),
		winKda: average(wins.map((s) => s.kda)),
		lossKda: average(losses.map((s) => s.kda)),
		winDeaths: average(wins.map((s) => s.deaths)),
		lossDeaths: average(losses.map((s) => s.deaths)),
		winDpm: average(wins.map((s) => s.damagePerMin)),
		lossDpm: average(losses.map((s) => s.damagePerMin)),
	};
}

function buildBenchmarkComparisons(
	summaries: MatchSummary[],
	tier: string | null,
): ScreeningReport["benchmarks"] {
	const roleComparisons: ScreeningReport["benchmarks"]["roleComparisons"] = [];
	const byRole = new Map<BenchmarkRole, MatchSummary[]>();
	for (const summary of summaries) {
		const role = normalizeBenchmarkRole(summary.lane);
		if (!role) continue;
		const rows = byRole.get(role) ?? [];
		rows.push(summary);
		byRole.set(role, rows);
	}

	for (const [role, rows] of byRole.entries()) {
		if (rows.length < 3) continue;
		roleComparisons.push({
			role: role.toUpperCase(),
			games: rows.length,
			kda: compareMetric({ metric: "kda", role, tier, rows, value: average(rows.map((s) => s.kda)) }),
			kills: compareMetric({
				metric: "kills",
				role,
				tier,
				rows,
				value: average(rows.map((s) => s.kills)),
			}),
			deaths: compareMetric({
				metric: "deaths",
				role,
				tier,
				rows,
				value: average(rows.map((s) => s.deaths)),
			}),
			csm: compareMetric({
				metric: "csm",
				role,
				tier,
				rows,
				value: average(rows.map((s) => s.csPerMin)),
			}),
		});
	}

	roleComparisons.sort((a, b) => b.games - a.games || a.role.localeCompare(b.role));
	return { tier, roleComparisons };
}

function compareMetric(input: {
	metric: BenchmarkMetric;
	role: BenchmarkRole;
	tier: string | null;
	rows: MatchSummary[];
	value: number;
}): MetricComparison | null {
	const side =
		input.rows.every((row) => row.side === "BLUE") || input.rows.every((row) => row.side === "RED")
			? (input.rows[0]?.side ?? null)
			: null;
	const benchmark = getBenchmarkRow({
		metric: input.metric,
		role: input.role,
		tier: input.tier,
		side,
	});
	if (!benchmark || benchmark.baseline <= 0) return null;
	return {
		value: input.value,
		baseline: benchmark.baseline,
		deltaPct: input.value / benchmark.baseline - 1,
	};
}

function buildStreaks(summaries: MatchSummary[]): ScreeningReport["streaks"] {
	let curWin = 0;
	let maxWin = 0;
	let curLoss = 0;
	let maxLoss = 0;
	for (const s of summaries) {
		if (s.win) {
			curWin += 1;
			curLoss = 0;
			maxWin = Math.max(maxWin, curWin);
		} else {
			curLoss += 1;
			curWin = 0;
			maxLoss = Math.max(maxLoss, curLoss);
		}
	}
	return { longestWinStreak: maxWin, longestLossStreak: maxLoss };
}

function buildVariability(summaries: MatchSummary[]): ScreeningReport["variability"] {
	const kdas = summaries.map((s) => s.kda);
	const dpms = summaries.map((s) => s.damagePerMin);
	const kdaMean = average(kdas);
	const kdaStdev = stdev(kdas, kdaMean);
	const dpmMean = average(dpms);
	const dpmStdev = stdev(dpms, dpmMean);
	return {
		kdaMean,
		kdaStdev,
		kdaCv: kdaMean > 0 ? kdaStdev / kdaMean : 0,
		dpmMean,
		dpmStdev,
		dpmCv: dpmMean > 0 ? dpmStdev / dpmMean : 0,
	};
}

function buildTimeOfDayHistogram(summaries: MatchSummary[]): number[] {
	const buckets = new Array<number>(24).fill(0);
	for (const s of summaries) {
		if (!Number.isFinite(s.playedAt) || s.playedAt <= 0) continue;
		const hour = new Date(s.playedAt).getUTCHours();
		const koreaHour = (hour + 9) % 24;
		buckets[koreaHour] = (buckets[koreaHour] ?? 0) + 1;
	}
	return buckets;
}

function scoreAccountTierMismatchRisk(input: {
	summonerLevel: number | undefined;
	rankedGames: number | null;
	summaries: MatchSummary[];
	profile: ScreeningReport["profile"];
	metrics: ScreeningReport["metrics"];
	benchmarks: ScreeningReport["benchmarks"];
	tier: string | null;
	evidence: Evidence[];
}): RiskScore {
	let score = 0;
	const reasons: string[] = [];
	const winRate = rate(input.summaries.filter((s) => s.win).length, input.summaries.length);
	const stompRate = rate(
		input.summaries.filter((s) => s.win && (s.kda >= 3.5 || (s.kda >= 2.5 && s.deathsPerMin <= 0.12)))
			.length,
		input.summaries.length,
	);
	let performanceScore = 0;
	let strongestDelta = 0;

	for (const role of input.benchmarks.roleComparisons) {
		const sampleFactor = role.games < 8 ? 0.5 : 1;
		const roleLabel = koBenchmarkRole(role.role);
		const addMetric = (
			metric: "kda" | "kills" | "csm" | "deaths",
			comparison: MetricComparison | null,
			points: number,
			reasonThreshold: number,
		) => {
			if (!comparison || points <= 0) return;
			const weighted = Math.round(points * sampleFactor * highTierDamping(input.tier));
			if (weighted <= 0) return;
			performanceScore += weighted;
			strongestDelta = Math.max(strongestDelta, Math.abs(comparison.deltaPct));
			addEvidence(
				input.evidence,
				"accountTierMismatch",
				`${role.role}.${metric}`,
				round(comparison.value, metric === "csm" || metric === "kda" ? 2 : 1),
				`${input.tier ?? "?"}/${roleLabel} ${round(comparison.baseline, 2)} (${signedPct(comparison.deltaPct)})`,
				weighted,
				`${roleLabel} ${labelMetric(metric)}가 같은 티어/포지션 기준선과 차이가 큽니다.`,
			);
			if (comparison.deltaPct >= reasonThreshold && metric !== "deaths") {
				reasons.push(`${roleLabel} ${labelMetric(metric)} ${signedPct(comparison.deltaPct)}`);
			} else if (comparison.deltaPct <= -reasonThreshold && metric === "deaths") {
				reasons.push(`${roleLabel} 데스 ${signedPct(comparison.deltaPct)}`);
			}
		};

		addMetric(
			"kda",
			role.kda,
			scorePositiveDelta(role.kda?.deltaPct ?? 0, [0.1, 0.2, 0.35], [6, 12, 18]),
			0.2,
		);
		addMetric(
			"kills",
			role.kills,
			scorePositiveDelta(role.kills?.deltaPct ?? 0, [0.1, 0.2, 0.35], [4, 8, 12]),
			0.2,
		);
		addMetric(
			"csm",
			role.csm,
			scorePositiveDelta(role.csm?.deltaPct ?? 0, [0.08, 0.15, 0.25], [4, 8, 12]),
			0.15,
		);
		addMetric(
			"deaths",
			role.deaths,
			scorePositiveDelta(-(role.deaths?.deltaPct ?? 0), [0.08, 0.15, 0.25], [3, 6, 10]),
			0.15,
		);
	}

	score += Math.min(55, performanceScore);
	if (input.summonerLevel != null) {
		const lvl = input.summonerLevel;
		let lvlScore = 0;
		let bucket = "";
		if (lvl < 30) {
			lvlScore = performanceScore >= 15 ? 18 : 5;
			bucket = "< 30";
		} else if (lvl < 50) {
			lvlScore = performanceScore >= 15 ? 12 : 4;
			bucket = "< 50";
		} else if (lvl < 80) {
			lvlScore = performanceScore >= 15 ? 7 : 2;
			bucket = "< 80";
		}
		if (lvlScore > 0) {
			score += lvlScore;
			addEvidence(
				input.evidence,
				"accountTierMismatch",
				"summonerLevel",
				lvl,
				`${bucket}${performanceScore >= 15 ? " + benchmark 과성과" : ""}`,
				lvlScore,
				"낮은 소환사 레벨은 benchmark 과성과과 함께 볼 때 계정/티어 불일치 신호입니다.",
			);
			reasons.push(`소환사 레벨 ${bucket}`);
		}
	}
	if (input.rankedGames != null) {
		const rg = input.rankedGames;
		let rgScore = 0;
		let bucket = "";
		if (rg < 20) {
			rgScore = performanceScore >= 15 ? 20 : 8;
			bucket = "< 20";
		} else if (rg < 40) {
			rgScore = performanceScore >= 15 ? 12 : 4;
			bucket = "< 40";
		} else if (rg < 80) {
			rgScore = performanceScore >= 15 ? 6 : 2;
			bucket = "< 80";
		}
		if (rgScore > 0) {
			score += rgScore;
			addEvidence(
				input.evidence,
				"accountTierMismatch",
				"soloRankedGames",
				rg,
				`${bucket}${performanceScore >= 15 ? " + benchmark 과성과" : ""}`,
				rgScore,
				"솔로랭크 누적 표본이 작습니다. 과성과 신호와 같이 볼 때 가중됩니다.",
			);
			reasons.push(`솔로랭크 누적 ${bucket}판`);
		}
	}

	if (
		input.metrics.averageDpm >= 700 &&
		(performanceScore >= 10 || (input.rankedGames != null && input.rankedGames < 40))
	) {
		score += 8;
		addEvidence(
			input.evidence,
			"accountTierMismatch",
			"damagePerMinute",
			Math.round(input.metrics.averageDpm),
			"보조: >= 700 + 저판수/benchmark 신호",
			8,
			"DPM은 benchmark 핵심 지표가 아니므로 저판수 또는 포지션 benchmark 신호가 있을 때만 보조로 사용합니다.",
		);
		reasons.push(`분당 피해량 ${Math.round(input.metrics.averageDpm)}`);
	}

	const winRateScore = winRate >= 0.65 ? 14 : winRate >= 0.58 ? 8 : winRate >= 0.52 ? 4 : 0;
	if (winRateScore > 0) {
		score += winRateScore;
		addEvidence(
			input.evidence,
			"accountTierMismatch",
			"recentWinRate",
			pct(winRate),
			">= 52%",
			winRateScore,
			"최근 솔로랭크 승률이 높습니다.",
		);
		if (winRate >= 0.58) reasons.push(`최근 승률 ${pct(winRate)}`);
	}

	if (stompRate >= 0.35 && performanceScore >= 10) {
		const stompScore = stompRate >= 0.5 ? 12 : 8;
		score += stompScore;
		addEvidence(
			input.evidence,
			"accountTierMismatch",
			"stompRate",
			pct(stompRate),
			">= 35% + benchmark 과성과",
			stompScore,
			"저데스 또는 고 KDA 승리 비율이 높습니다.",
		);
		reasons.push(`압도적 승리 비율 ${pct(stompRate)}`);
	}

	const carryRate = rate(
		input.summaries.filter(
			(s) => (s.kda >= 3.5 && s.damagePerMin >= 650) || (s.kda >= 2.5 && s.kda * s.minutes >= 55),
		).length,
		input.summaries.length,
	);
	if (carryRate >= 0.4 && performanceScore >= 10) {
		const carryScore = carryRate >= 0.55 ? 10 : 6;
		score += carryScore;
		addEvidence(
			input.evidence,
			"accountTierMismatch",
			"carryRate",
			pct(carryRate),
			">= 40% + benchmark 과성과",
			carryScore,
			"캐리형 경기 비율은 benchmark 과성과이 있을 때만 보조 신호로 사용합니다.",
		);
		reasons.push("캐리형 경기 비율 높음");
	}

	const mainRoleDominance = input.benchmarks.roleComparisons[0];
	if (
		mainRoleDominance &&
		mainRoleDominance.games >= 20 &&
		(mainRoleDominance.kda?.deltaPct ?? 0) >= 0.2 &&
		(mainRoleDominance.deaths?.deltaPct ?? 0) <= -0.25 &&
		((mainRoleDominance.csm?.deltaPct ?? 0) >= 0.08 ||
			winRate >= 0.58 ||
			stompRate >= 0.45 ||
			carryRate >= 0.55)
	) {
		score += 18;
		addEvidence(
			input.evidence,
			"accountTierMismatch",
			"mainRoleDominance",
			`${koBenchmarkRole(mainRoleDominance.role)} ${mainRoleDominance.games}판`,
			`KDA ${signedPct(mainRoleDominance.kda?.deltaPct ?? 0)} · 데스 ${signedPct(mainRoleDominance.deaths?.deltaPct ?? 0)}`,
			18,
			"주 포지션에서 KDA 상승과 데스 하락이 장기 표본으로 동시에 나타납니다.",
		);
		reasons.push("주 포지션 동시 과성과");
	}

	const hasNewAccountSignal =
		(input.summonerLevel != null && input.summonerLevel < 70) ||
		(input.rankedGames != null && input.rankedGames < 80);
	if (hasNewAccountSignal && performanceScore >= 20 && strongestDelta >= 0.15) {
		score += 12;
		addEvidence(
			input.evidence,
			"accountTierMismatch",
			"newAccountBenchmarkOutlier",
			`lvl ${input.summonerLevel ?? "?"} · ${input.rankedGames ?? "?"}판`,
			"신규/저판수 + benchmark 과성과",
			12,
			"신규/저판수 계정에서 포지션 benchmark 대비 과성과이 같이 나타납니다.",
		);
		reasons.push("신규/저판수 + 과성과");
	}
	if (
		input.summonerLevel != null &&
		input.summonerLevel < 60 &&
		input.profile.top1Concentration >= 0.5 &&
		input.summaries.length >= 10
	) {
		const focusScore = performanceScore >= 15 ? 6 : 2;
		score += focusScore;
		addEvidence(
			input.evidence,
			"accountTierMismatch",
			"newAccount1ChampFocus",
			`Top1 ${pct(input.profile.top1Concentration)} @ lvl ${input.summonerLevel}`,
			"신규+1챔 집중 ≥ 50%",
			focusScore,
			"신규 계정에서 단일 챔피언 집중도가 높습니다.",
		);
		reasons.push("신규 계정 + 1챔 파기");
	}

	return risk(score, reasons);
}

function scoreDerankOrThrowRisk(input: {
	summaries: MatchSummary[];
	metrics: ScreeningReport["metrics"];
	benchmarks: ScreeningReport["benchmarks"];
	evidence: Evidence[];
}): RiskScore {
	let score = 0;
	const reasons: string[] = [];
	const lossStreak = longestLossStreak(input.summaries);

	if (lossStreak >= 7) {
		score += 15;
		addEvidence(
			input.evidence,
			"derankOrThrow",
			"longestLossStreak",
			lossStreak,
			">= 7",
			15,
			"긴 연패는 단독 판정이 아니라 추가 검토 신호입니다.",
		);
		reasons.push("최근 표본 내 7연패 이상");
	} else if (lossStreak >= 5) {
		score += 15;
		addEvidence(
			input.evidence,
			"derankOrThrow",
			"longestLossStreak",
			lossStreak,
			">= 5",
			15,
			"5연패 이상이 표본 안에 존재합니다.",
		);
		reasons.push("최근 표본 내 5연패 이상");
	}
	const lossDeathAnomaly = maxLossDeathBenchmarkDelta(input.summaries, input.benchmarks.tier);
	if (lossDeathAnomaly && lossDeathAnomaly.deltaPct >= 0.2) {
		const deathScore = lossDeathAnomaly.deltaPct >= 0.35 ? 15 : 8;
		score += deathScore;
		addEvidence(
			input.evidence,
			"derankOrThrow",
			"lossDeathsVsBenchmark",
			round(lossDeathAnomaly.value, 1),
			`${input.benchmarks.tier ?? "?"}/${koBenchmarkRole(lossDeathAnomaly.role)} ${round(lossDeathAnomaly.baseline, 1)} (${signedPct(lossDeathAnomaly.deltaPct)})`,
			deathScore,
			"패배 경기 데스가 같은 티어/포지션 기준선보다 높습니다.",
		);
		reasons.push("패배 경기 데스 기준선 초과");
	}
	if (
		input.metrics.lossKda > 0 &&
		input.metrics.lossKda < 1.2 &&
		input.metrics.winKda >= 2.5 &&
		lossDeathAnomaly
	) {
		score += 12;
		addEvidence(
			input.evidence,
			"derankOrThrow",
			"lossVsWinKda",
			`${round(input.metrics.lossKda, 2)} / ${round(input.metrics.winKda, 2)}`,
			"loss < 1.2, win >= 2.5, death anomaly",
			12,
			"승리/패배 구간의 기여도 차이가 크고 패배 데스 기준선 초과가 동반됩니다.",
		);
		reasons.push("승패 구간 KDA 격차 큼");
	}
	const lossDeathPerMin = average(input.summaries.filter((s) => !s.win).map((s) => s.deathsPerMin));
	if (lossDeathPerMin >= 0.35) {
		score += 10;
		addEvidence(
			input.evidence,
			"derankOrThrow",
			"lossDeathsPerMinute",
			round(lossDeathPerMin, 2),
			">= 0.35",
			10,
			"패배 경기 사망 빈도가 높습니다.",
		);
		reasons.push("패배 경기 사망 빈도 높음");
	}
	return risk(score, reasons);
}

function scoreAccountConsistencyRisk(input: {
	summaries: MatchSummary[];
	variability: ScreeningReport["variability"];
	profile: ScreeningReport["profile"];
	timeOfDayHistogram: number[];
	evidence: Evidence[];
}): RiskScore {
	if (input.summaries.length < CONSISTENCY_MIN_SAMPLE) {
		return risk(0, []);
	}
	let score = 0;
	const reasons: string[] = [];
	let strongSignals = 0;

	if (input.variability.kdaMean > 0 && input.variability.kdaCv >= 0.85) {
		score += 12;
		addEvidence(
			input.evidence,
			"accountConsistency",
			"kdaCoefficientOfVariation",
			round(input.variability.kdaCv, 2),
			">= 0.85",
			12,
			"KDA 변동 폭이 크면 동일 사용자 일관성이 낮습니다.",
		);
		reasons.push("KDA 변동성 큼");
	}

	const swap = championSwap(input.summaries);
	if (swap && swap.recentSize >= 5 && swap.earlierSize >= 5 && swap.distance >= 0.8) {
		score += 25;
		strongSignals += 1;
		addEvidence(
			input.evidence,
			"accountConsistency",
			"championSetJaccardDistance",
			round(swap.distance, 2),
			">= 0.80",
			25,
			"전후 표본 챔피언 풀이 거의 겹치지 않습니다.",
		);
		reasons.push("챔피언 풀 전환");
	}

	const laneSwap = laneSwapSignal(input.summaries);
	if (laneSwap) {
		score += 20;
		strongSignals += 1;
		addEvidence(
			input.evidence,
			"accountConsistency",
			"laneSwap",
			`${laneSwap.recentLane}/${pct(laneSwap.recentRate)} → ${laneSwap.earlierLane}/${pct(laneSwap.earlierRate)}`,
			"주 라인 60% 이상 양쪽, 다른 라인",
			20,
			"전후 표본 주 라인이 바뀝니다.",
		);
		reasons.push("주 라인 전환");
	}

	const bimodality = bimodalTimeOfDay(input.timeOfDayHistogram, input.summaries.length);
	if (bimodality) {
		score += 15;
		strongSignals += 1;
		addEvidence(
			input.evidence,
			"accountConsistency",
			"playTimeBimodality",
			`${bimodality.first}시·${bimodality.second}시`,
			"두 modal 간격 ≥ 8h, 각 ≥ 25%",
			15,
			"플레이 시간대가 두 클러스터로 갈립니다.",
		);
		reasons.push("플레이 시간대 이중 모달");
	}

	const meanAbsKdaDelta = meanAbsoluteDelta(input.summaries.map((s) => s.kda));
	if (meanAbsKdaDelta >= 3.0) {
		score += 8;
		addEvidence(
			input.evidence,
			"accountConsistency",
			"adjacentKdaDelta",
			round(meanAbsKdaDelta, 2),
			">= 3.0",
			8,
			"인접 경기 KDA 변동 폭이 큽니다.",
		);
		reasons.push("연속 경기 KDA 급변");
	}

	const split = splitWinRateDelta(input.summaries);
	if (split && Math.abs(split.delta) >= 0.3) {
		const splitScore = sampleDays(input.summaries) > 90 ? 8 : 15;
		score += splitScore;
		if (splitScore >= 15) strongSignals += 1;
		addEvidence(
			input.evidence,
			"accountConsistency",
			"splitWinRateDelta",
			`${pct(split.recent)} / ${pct(split.earlier)}`,
			"양 끝 25% 승률 차 ≥ 30%p",
			splitScore,
			"표본 전후 승률 격차가 큽니다.",
		);
		reasons.push("표본 전후 승률 분할");
	}

	const mainLaneDpms = mainLaneDpmSeries(input.summaries);
	if (mainLaneDpms.length >= 8) {
		const meanDpm = average(mainLaneDpms);
		const stdDpm = stdev(mainLaneDpms, meanDpm);
		const cv = meanDpm > 0 ? stdDpm / meanDpm : 0;
		if (cv >= 0.45) {
			score += 10;
			addEvidence(
				input.evidence,
				"accountConsistency",
				"mainLaneDpmCv",
				round(cv, 2),
				">= 0.45",
				10,
				"주 라인 경기 안에서도 분당 피해 변동 폭이 큽니다.",
			);
			reasons.push("주 라인 DPM 변동성 큼");
		}
	}

	if (score >= 50 && strongSignals < 2) return risk(39, reasons);
	return risk(score, reasons);
}

function scoreRoleMismatchRisk(input: {
	summaries: MatchSummary[];
	evidence: Evidence[];
}): RiskScore {
	const lanes = input.summaries.map((s) => s.lane).filter((lane): lane is string => lane !== null);
	if (lanes.length === 0) {
		addEvidence(
			input.evidence,
			"roleMismatch",
			"validRoleSamples",
			0,
			"> 0",
			25,
			"포지션 판정 가능한 솔로랭크 경기 표본이 없습니다.",
		);
		return risk(25, ["포지션 표본 없음"]);
	}
	const counts = topCounts(lanes, lanes.length);
	const top = counts[0];
	const tiedTopCount = counts.filter(([, games]) => games === top?.[1]).length;
	let score = 0;
	const reasons: string[] = [];
	if (top && top[2] < 0.5) {
		score += 15;
		addEvidence(
			input.evidence,
			"roleMismatch",
			"topRoleRate",
			pct(top[2]),
			"< 50%",
			15,
			"최근 솔로랭크 포지션이 분산되어 있습니다.",
		);
		reasons.push("주 포지션 일관성 낮음");
	}
	if (tiedTopCount > 1) {
		score += 10;
		reasons.push("최다 포지션 동률");
	}
	return risk(score, reasons);
}

function scoreDataQualityRisk(input: {
	analyzedMatches: number;
	excludedMatches: number;
	totalMatches: number;
	evidence: Evidence[];
}): RiskScore {
	let score = 0;
	const reasons: string[] = [];
	if (input.analyzedMatches < 10) {
		score += 40;
		reasons.push("분석 가능 표본 10판 미만");
	} else if (input.analyzedMatches < 20) {
		score += 25;
		reasons.push("분석 가능 표본 20판 미만");
	} else if (input.analyzedMatches < 35) {
		score += 10;
		reasons.push("분석 가능 표본 35판 미만");
	}
	const excludedRate = rate(input.excludedMatches, input.totalMatches);
	if (excludedRate >= 0.25) {
		score += 10;
		reasons.push("제외된 경기 비율 높음");
	}
	if (score > 0) {
		addEvidence(
			input.evidence,
			"dataQuality",
			"analyzedMatches",
			input.analyzedMatches,
			">= 35",
			score,
			"리포트 신뢰도는 분석 가능한 솔로랭크 표본 수에 좌우됩니다.",
		);
	}
	return risk(score, reasons);
}

function scoreOverall(input: {
	accountTierMismatchRisk: RiskScore;
	derankOrThrowRisk: RiskScore;
	accountConsistencyRisk: RiskScore;
	roleMismatchRisk: RiskScore;
	dataQualityRisk: RiskScore;
	confidence: Confidence;
}): RiskScore {
	const weighted =
		0.35 * input.accountTierMismatchRisk.score +
		0.15 * input.derankOrThrowRisk.score +
		0.2 * input.accountConsistencyRisk.score +
		0.07 * input.roleMismatchRisk.score +
		0.23 * input.dataQualityRisk.score;
	const primaryMax = Math.max(
		input.accountTierMismatchRisk.score,
		input.derankOrThrowRisk.score,
		input.accountConsistencyRisk.score,
	);
	const score = 0.45 * primaryMax + 0.55 * weighted;
	const reasons = [
		...input.accountTierMismatchRisk.reasons.slice(0, 2),
		...input.derankOrThrowRisk.reasons.slice(0, 1),
		...input.accountConsistencyRisk.reasons.slice(0, 2),
	];
	if (input.confidence === "LOW") reasons.push("데이터 신뢰도 낮음");
	return risk(Math.round(score), reasons);
}

function normalizeLane(participant: MatchParticipantDto): string | null {
	const lane = participant.teamPosition || participant.individualPosition;
	return VALID_LANES.has(lane) ? lane : null;
}

function maxLossDeathBenchmarkDelta(
	summaries: MatchSummary[],
	tier: string | null,
): ({ role: BenchmarkRole } & MetricComparison) | null {
	let best: ({ role: BenchmarkRole } & MetricComparison) | null = null;
	const lossesByRole = new Map<BenchmarkRole, MatchSummary[]>();
	for (const summary of summaries) {
		if (summary.win) continue;
		const role = normalizeBenchmarkRole(summary.lane);
		if (!role) continue;
		const rows = lossesByRole.get(role) ?? [];
		rows.push(summary);
		lossesByRole.set(role, rows);
	}
	for (const [role, rows] of lossesByRole.entries()) {
		if (rows.length < 3) continue;
		const comparison = compareMetric({
			metric: "deaths",
			role,
			tier,
			rows,
			value: average(rows.map((s) => s.deaths)),
		});
		if (!comparison) continue;
		if (!best || comparison.deltaPct > best.deltaPct) best = { role, ...comparison };
	}
	return best;
}

function scorePositiveDelta(
	deltaPct: number,
	thresholds: [number, number, number],
	scores: [number, number, number],
): number {
	if (deltaPct >= thresholds[2]) return scores[2];
	if (deltaPct >= thresholds[1]) return scores[1];
	if (deltaPct >= thresholds[0]) return scores[0];
	return 0;
}

function highTierDamping(tier: string | null): number {
	if (tier === "CHALLENGER") return 0.65;
	if (tier === "GRANDMASTER" || tier === "MASTER") return 0.8;
	return 1;
}

function koBenchmarkRole(role: string): string {
	switch (role.toLowerCase()) {
		case "top":
			return "탑";
		case "jungle":
			return "정글";
		case "middle":
			return "미드";
		case "bottom":
			return "원딜";
		default:
			return role;
	}
}

function labelMetric(metric: string): string {
	switch (metric) {
		case "kda":
			return "KDA";
		case "kills":
			return "킬";
		case "deaths":
			return "데스";
		case "csm":
			return "CS/M";
		default:
			return metric;
	}
}

function signedPct(value: number): string {
	const rounded = Math.round(value * 100);
	return `${rounded >= 0 ? "+" : ""}${rounded}%`;
}

function topCounts(values: string[], denominator: number): Array<[string, number, number]> {
	const counts = new Map<string, number>();
	for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
	return Array.from(counts.entries())
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, 5)
		.map(([value, count]) => [value, count, denominator > 0 ? count / denominator : 0]);
}

function topChampionCounts(summaries: MatchSummary[]): ScreeningReport["profile"]["mainChampions"] {
	const counts = new Map<string, { games: number; wins: number }>();
	for (const summary of summaries) {
		const item = counts.get(summary.champion) ?? { games: 0, wins: 0 };
		item.games += 1;
		if (summary.win) item.wins += 1;
		counts.set(summary.champion, item);
	}
	return Array.from(counts.entries())
		.sort((a, b) => b[1].games - a[1].games || a[0].localeCompare(b[0]))
		.slice(0, 5)
		.map(([champion, item]) => ({
			champion,
			games: item.games,
			wins: item.wins,
			winRate: item.games > 0 ? item.wins / item.games : 0,
		}));
}

function dateRangeFor(summaries: MatchSummary[]): { from: string | null; to: string | null } {
	const times = summaries.map((s) => s.playedAt).filter((t) => Number.isFinite(t) && t > 0);
	if (times.length === 0) return { from: null, to: null };
	return {
		from: new Date(Math.min(...times)).toISOString(),
		to: new Date(Math.max(...times)).toISOString(),
	};
}

function sampleDays(summaries: MatchSummary[]): number {
	const times = summaries.map((s) => s.playedAt).filter((t) => Number.isFinite(t) && t > 0);
	if (times.length < 2) return 0;
	return (Math.max(...times) - Math.min(...times)) / DAY_MS;
}

function confidenceFor(count: number): Confidence {
	if (count >= 50) return "HIGH";
	if (count >= 20) return "MEDIUM";
	return "LOW";
}

function recommendationFor(input: {
	overall: number;
	consistency: number;
	confidence: Confidence;
	summonerLevel: number | undefined;
	rankedGames: number | null;
}): Recommendation {
	if (input.consistency >= 70) return "REJECT_OR_INTERVIEW";
	if (input.overall >= 70) return "REJECT_OR_INTERVIEW";
	if (input.consistency >= 50) return "MANUAL_REVIEW";
	if (input.confidence === "LOW") {
		const newAccount =
			(input.summonerLevel != null && input.summonerLevel < 50) ||
			(input.rankedGames != null && input.rankedGames < 30);
		if (newAccount) return "MANUAL_REVIEW";
		return input.overall >= 30 ? "MANUAL_REVIEW" : "AUTO_PASS";
	}
	if (input.overall >= 30) return "MANUAL_REVIEW";
	return "AUTO_PASS";
}

function buildSummary(input: {
	overall: RiskScore;
	accountTierMismatchRisk: RiskScore;
	derankOrThrowRisk: RiskScore;
	accountConsistencyRisk: RiskScore;
	recommendation: Recommendation;
}): ScreeningReport["summary"] {
	const reasons: string[] = [];
	const candidates: Array<[number, string[]]> = [
		[input.accountTierMismatchRisk.score, input.accountTierMismatchRisk.reasons],
		[input.accountConsistencyRisk.score, input.accountConsistencyRisk.reasons],
		[input.derankOrThrowRisk.score, input.derankOrThrowRisk.reasons],
	];
	candidates.sort((a, b) => b[0] - a[0]);
	for (const [, list] of candidates) {
		for (const r of list) {
			if (!reasons.includes(r)) reasons.push(r);
			if (reasons.length >= 3) break;
		}
		if (reasons.length >= 3) break;
	}
	const headlineLeader = leadCategory(input);
	const action =
		input.recommendation === "REJECT_OR_INTERVIEW"
			? "추가 인증/인터뷰 필요"
			: input.recommendation === "MANUAL_REVIEW"
				? "운영 수동 검토 필요"
				: "특이 신호 약함";
	const headline = `${headlineLeader} · ${action}`;
	return { headline, primaryReasons: reasons };
}

function leadCategory(input: {
	accountTierMismatchRisk: RiskScore;
	derankOrThrowRisk: RiskScore;
	accountConsistencyRisk: RiskScore;
}): string {
	const items: Array<[string, number]> = [
		["계정/티어 불일치", input.accountTierMismatchRisk.score],
		["계정 일관성 의심", input.accountConsistencyRisk.score],
		["패배 패턴 의심", input.derankOrThrowRisk.score],
	];
	items.sort((a, b) => b[1] - a[1]);
	const top = items[0];
	if (!top || top[1] === 0) return "주요 신호 없음";
	return `${top[0]} ${top[1]}점`;
}

function risk(score: number, reasons: string[]): RiskScore {
	const normalized = clampInt(Math.round(score), 0, 100);
	return {
		score: normalized,
		level: normalized >= 70 ? "HIGH" : normalized >= 40 ? "MEDIUM" : "LOW",
		reasons,
	};
}

function addEvidence(
	evidence: Evidence[],
	category: string,
	metric: string,
	value: number | string,
	threshold: number | string,
	weight: number,
	description: string,
): void {
	evidence.push({ category, metric, value, threshold, weight, description });
}

function pct(value: number): string {
	return `${Math.round(value * 100)}%`;
}

function round(value: number, digits: number): number {
	const factor = 10 ** digits;
	return Math.round(value * factor) / factor;
}

function average(values: number[]): number {
	if (values.length === 0) return 0;
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdev(values: number[], mean: number): number {
	if (values.length < 2) return 0;
	const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
	return Math.sqrt(variance);
}

function meanAbsoluteDelta(values: number[]): number {
	if (values.length < 2) return 0;
	let total = 0;
	for (let i = 1; i < values.length; i += 1) {
		const a = values[i] ?? 0;
		const b = values[i - 1] ?? 0;
		total += Math.abs(a - b);
	}
	return total / (values.length - 1);
}

function rate(part: number, total: number): number {
	return total > 0 ? part / total : 0;
}

function longestLossStreak(summaries: MatchSummary[]): number {
	let current = 0;
	let longest = 0;
	for (const summary of summaries) {
		if (summary.win) {
			current = 0;
		} else {
			current += 1;
			longest = Math.max(longest, current);
		}
	}
	return longest;
}

function clampInt(value: number, min: number, max: number): number {
	if (!Number.isFinite(value)) return min;
	return Math.max(min, Math.min(max, Math.trunc(value)));
}

function championSwap(
	summaries: MatchSummary[],
): { distance: number; recentSize: number; earlierSize: number } | null {
	if (summaries.length < CONSISTENCY_MIN_SAMPLE) return null;
	const half = Math.floor(summaries.length / 2);
	const recent = new Set(summaries.slice(0, half).map((s) => s.champion));
	const earlier = new Set(summaries.slice(half).map((s) => s.champion));
	const distance = jaccardDistance(recent, earlier);
	return { distance, recentSize: recent.size, earlierSize: earlier.size };
}

function jaccardDistance(a: Set<string>, b: Set<string>): number {
	if (a.size === 0 && b.size === 0) return 0;
	let intersection = 0;
	for (const item of a) if (b.has(item)) intersection += 1;
	const union = a.size + b.size - intersection;
	if (union === 0) return 0;
	return 1 - intersection / union;
}

function laneSwapSignal(
	summaries: MatchSummary[],
): { recentLane: string; recentRate: number; earlierLane: string; earlierRate: number } | null {
	if (summaries.length < CONSISTENCY_MIN_SAMPLE) return null;
	const half = Math.floor(summaries.length / 2);
	const recentLanes = summaries
		.slice(0, half)
		.map((s) => s.lane)
		.filter((l): l is string => l !== null);
	const earlierLanes = summaries
		.slice(half)
		.map((s) => s.lane)
		.filter((l): l is string => l !== null);
	if (recentLanes.length < 5 || earlierLanes.length < 5) return null;
	const recentTop = topCounts(recentLanes, recentLanes.length)[0];
	const earlierTop = topCounts(earlierLanes, earlierLanes.length)[0];
	if (!recentTop || !earlierTop) return null;
	if (recentTop[0] === earlierTop[0]) return null;
	if (recentTop[2] < 0.6 || earlierTop[2] < 0.6) return null;
	return {
		recentLane: recentTop[0],
		recentRate: recentTop[2],
		earlierLane: earlierTop[0],
		earlierRate: earlierTop[2],
	};
}

function bimodalTimeOfDay(
	histogram: number[],
	totalGames: number,
): { first: number; second: number } | null {
	if (totalGames < CONSISTENCY_MIN_SAMPLE) return null;
	const buckets = histogram.map((count, hour) => ({ hour, count }));
	buckets.sort((a, b) => b.count - a.count);
	const first = buckets[0];
	const second = buckets.find((b) => circularHourDistance(b.hour, first?.hour ?? 0) >= 8);
	if (!first || !second) return null;
	const firstShare = first.count / totalGames;
	const secondShare = second.count / totalGames;
	if (firstShare < 0.25 || secondShare < 0.25) return null;
	return { first: first.hour, second: second.hour };
}

function circularHourDistance(a: number, b: number): number {
	const diff = Math.abs(a - b);
	return Math.min(diff, 24 - diff);
}

function splitWinRateDelta(
	summaries: MatchSummary[],
): { recent: number; earlier: number; delta: number } | null {
	if (summaries.length < 20) return null;
	const quartile = Math.max(10, Math.floor(summaries.length / 4));
	const recent = summaries.slice(0, quartile);
	const earlier = summaries.slice(-quartile);
	if (recent.length < 10 || earlier.length < 10) return null;
	const recentWr = rate(recent.filter((s) => s.win).length, recent.length);
	const earlierWr = rate(earlier.filter((s) => s.win).length, earlier.length);
	return { recent: recentWr, earlier: earlierWr, delta: recentWr - earlierWr };
}

function mainLaneDpmSeries(summaries: MatchSummary[]): number[] {
	const lanes = summaries.map((s) => s.lane).filter((l): l is string => l !== null);
	if (lanes.length === 0) return [];
	const top = topCounts(lanes, lanes.length)[0];
	if (!top) return [];
	const mainLane = top[0];
	return summaries.filter((s) => s.lane === mainLane).map((s) => s.damagePerMin);
}

async function mapConcurrent<T, R>(
	items: readonly T[],
	concurrency: number,
	mapper: (item: T) => Promise<R>,
): Promise<R[]> {
	const results: R[] = [];
	let next = 0;
	const workerCount = Math.min(Math.max(concurrency, 1), items.length);
	await Promise.all(
		Array.from({ length: workerCount }, async () => {
			while (next < items.length) {
				const index = next;
				next += 1;
				results[index] = await mapper(items[index] as T);
			}
		}),
	);
	return results;
}
