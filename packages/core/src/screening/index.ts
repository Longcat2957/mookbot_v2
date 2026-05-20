import { getRiotClient, type Platform, type Region } from "../riot/client.js";
import type { LeagueEntryDto, MatchDto, MatchParticipantDto } from "../riot/types.js";

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
	version: "0.20.0-mvp";
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
	};
	scores: {
		smurfRisk: RiskScore;
		rankMismatchRisk: RiskScore;
		derankOrThrowRisk: RiskScore;
		roleMismatchRisk: RiskScore;
		dataQualityRisk: RiskScore;
		overallReviewRisk: RiskScore;
	};
	evidence: Evidence[];
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
	kda: number;
}

const SOLO_QUEUE_ID = 420;
const MATCH_DETAIL_CONCURRENCY = 5;
const MIN_ANALYZABLE_SECONDS = 300;
const VALID_LANES = new Set(["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]);

export async function generateLolScreeningReport(input: GenerateInput): Promise<ScreeningReport> {
	const region = input.region ?? "ASIA";
	const platform = input.platform ?? "KR";
	const requestedMatches = clampInt(input.sample ?? 30, 1, 50);
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
	const excludedMatches = matchIds.length - summaries.length;
	const soloEntry = leagueEntries.find((entry) => entry.queueType === "RANKED_SOLO_5x5");
	const evidence: Evidence[] = [];

	const sampleConfidence = confidenceFor(summaries.length);
	const profile = buildProfile(summaries, soloEntry);
	const smurfRisk = scoreSmurfRisk({
		summonerLevel: summoner.summonerLevel,
		soloEntry,
		summaries,
		evidence,
	});
	const rankMismatchRisk = scoreRankMismatchRisk({ summaries, evidence });
	const derankOrThrowRisk = scoreDerankOrThrowRisk({ summaries, evidence });
	const roleMismatchRisk = scoreRoleMismatchRisk({ summaries, evidence });
	const dataQualityRisk = scoreDataQualityRisk({
		analyzedMatches: summaries.length,
		excludedMatches,
		totalMatches: matchIds.length,
		evidence,
	});
	const overallReviewRisk = scoreOverall({
		smurfRisk,
		rankMismatchRisk,
		derankOrThrowRisk,
		roleMismatchRisk,
		dataQualityRisk,
		confidence: sampleConfidence,
	});

	return {
		version: "0.20.0-mvp",
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
		scores: {
			smurfRisk,
			rankMismatchRisk,
			derankOrThrowRisk,
			roleMismatchRisk,
			dataQualityRisk,
			overallReviewRisk,
		},
		evidence,
		recommendation: recommendationFor(overallReviewRisk.score, sampleConfidence),
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
		mainChampions: topChampionCounts(summaries),
	};
}

function scoreSmurfRisk(input: {
	summonerLevel: number | undefined;
	soloEntry: LeagueEntryDto | undefined;
	summaries: MatchSummary[];
	evidence: Evidence[];
}): RiskScore {
	let score = 0;
	const reasons: string[] = [];
	const rankedGames = input.soloEntry ? input.soloEntry.wins + input.soloEntry.losses : null;
	const winRate = rate(input.summaries.filter((s) => s.win).length, input.summaries.length);
	const avgKda = average(input.summaries.map((s) => s.kda));
	const stompRate = rate(
		input.summaries.filter((s) => s.win && s.kda >= 4 && s.deaths <= 3).length,
		input.summaries.length,
	);

	if (input.summonerLevel != null && input.summonerLevel < 50) {
		score += 20;
		add(
			input.evidence,
			"smurf",
			"summonerLevel",
			input.summonerLevel,
			"< 50",
			20,
			"낮은 소환사 레벨은 신규/부계정 가능성 신호로만 취급합니다.",
		);
		reasons.push("소환사 레벨 50 미만");
	}
	if (rankedGames != null && rankedGames < 40) {
		score += 15;
		add(
			input.evidence,
			"smurf",
			"soloRankedGames",
			rankedGames,
			"< 40",
			15,
			"솔로랭크 누적 표본이 작습니다.",
		);
		reasons.push("솔로랭크 누적 판수 40판 미만");
	}
	if (winRate >= 0.65) {
		score += 35;
		add(
			input.evidence,
			"smurf",
			"recentWinRate",
			pct(winRate),
			">= 65%",
			35,
			"최근 솔로랭크 승률이 높습니다.",
		);
		reasons.push("최근 승률 65% 이상");
	} else if (winRate >= 0.6) {
		score += 22;
		add(
			input.evidence,
			"smurf",
			"recentWinRate",
			pct(winRate),
			">= 60%",
			22,
			"최근 솔로랭크 승률이 다소 높습니다.",
		);
		reasons.push("최근 승률 60% 이상");
	}
	if (avgKda >= 4) {
		score += 15;
		add(
			input.evidence,
			"smurf",
			"averageKda",
			round(avgKda, 2),
			">= 4.0",
			15,
			"최근 경기 KDA가 높습니다.",
		);
		reasons.push("최근 평균 KDA 4.0 이상");
	}
	if (stompRate >= 0.35) {
		score += 15;
		add(
			input.evidence,
			"smurf",
			"stompRate",
			pct(stompRate),
			">= 35%",
			15,
			"저데스 고관여 승리 비율이 높습니다.",
		);
		reasons.push("압도적 승리 패턴 비율 높음");
	}
	return risk(score, reasons);
}

function scoreRankMismatchRisk(input: {
	summaries: MatchSummary[];
	evidence: Evidence[];
}): RiskScore {
	let score = 0;
	const reasons: string[] = [];
	const winRate = rate(input.summaries.filter((s) => s.win).length, input.summaries.length);
	const avgKda = average(input.summaries.map((s) => s.kda));
	const avgDamage = average(input.summaries.map((s) => s.damagePerMin));
	const avgGold = average(input.summaries.map((s) => s.goldPerMin));
	const carryRate = rate(
		input.summaries.filter((s) => s.kda >= 4 && s.damagePerMin >= 700).length,
		input.summaries.length,
	);

	if (winRate >= 0.65) {
		score += 30;
		reasons.push("최근 승률 65% 이상");
	} else if (winRate >= 0.6) {
		score += 20;
		reasons.push("최근 승률 60% 이상");
	}
	if (avgKda >= 4) {
		score += 15;
		add(
			input.evidence,
			"rankMismatch",
			"averageKda",
			round(avgKda, 2),
			">= 4.0",
			15,
			"최근 경기 KDA가 표시 티어 대비 추가 검토 신호가 될 수 있습니다.",
		);
		reasons.push("최근 평균 KDA 높음");
	}
	if (avgDamage >= 700) {
		score += 20;
		add(
			input.evidence,
			"rankMismatch",
			"damagePerMinute",
			Math.round(avgDamage),
			">= 700",
			20,
			"분당 챔피언 피해량이 높습니다.",
		);
		reasons.push("분당 피해량 높음");
	}
	if (avgGold >= 420) {
		score += 15;
		add(
			input.evidence,
			"rankMismatch",
			"goldPerMinute",
			Math.round(avgGold),
			">= 420",
			15,
			"분당 골드가 높습니다.",
		);
		reasons.push("분당 골드 높음");
	}
	if (carryRate >= 0.35) {
		score += 25;
		add(
			input.evidence,
			"rankMismatch",
			"carryRate",
			pct(carryRate),
			">= 35%",
			25,
			"고 KDA와 높은 피해량이 함께 나온 경기 비율입니다.",
		);
		reasons.push("캐리형 경기 비율 높음");
	}
	return risk(score, reasons);
}

function scoreDerankOrThrowRisk(input: {
	summaries: MatchSummary[];
	evidence: Evidence[];
}): RiskScore {
	let score = 0;
	const reasons: string[] = [];
	const lossStreak = longestLossStreak(input.summaries);
	const losses = input.summaries.filter((s) => !s.win);
	const wins = input.summaries.filter((s) => s.win);
	const lossKda = average(losses.map((s) => s.kda));
	const winKda = average(wins.map((s) => s.kda));
	const lossDeaths = average(losses.map((s) => s.deaths));
	const lossDeathPerMin = average(losses.map((s) => s.deaths / s.minutes));

	if (lossStreak >= 7) {
		score += 25;
		add(
			input.evidence,
			"derankOrThrow",
			"longestLossStreak",
			lossStreak,
			">= 7",
			25,
			"긴 연패는 단독 판정이 아니라 추가 검토 신호입니다.",
		);
		reasons.push("최근 표본 내 7연패 이상");
	} else if (lossStreak >= 5) {
		score += 15;
		reasons.push("최근 표본 내 5연패 이상");
	}
	if (lossDeaths >= 8) {
		score += 15;
		add(
			input.evidence,
			"derankOrThrow",
			"lossAverageDeaths",
			round(lossDeaths, 1),
			">= 8",
			15,
			"패배 경기 평균 데스가 높습니다.",
		);
		reasons.push("패배 경기 평균 데스 높음");
	}
	if (lossKda > 0 && lossKda < 1.2 && winKda >= 2.5) {
		score += 20;
		add(
			input.evidence,
			"derankOrThrow",
			"lossVsWinKda",
			`${round(lossKda, 2)} / ${round(winKda, 2)}`,
			"loss < 1.2, win >= 2.5",
			20,
			"승리/패배 구간의 기여도 차이가 큽니다.",
		);
		reasons.push("승패 구간 KDA 격차 큼");
	}
	if (lossDeathPerMin >= 0.35) {
		score += 10;
		add(
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

function scoreRoleMismatchRisk(input: {
	summaries: MatchSummary[];
	evidence: Evidence[];
}): RiskScore {
	const lanes = input.summaries.map((s) => s.lane).filter((lane): lane is string => lane !== null);
	if (lanes.length === 0) {
		add(
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
		add(
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
	}
	const excludedRate = rate(input.excludedMatches, input.totalMatches);
	if (excludedRate >= 0.25) {
		score += 10;
		reasons.push("제외된 경기 비율 높음");
	}
	if (score > 0) {
		add(
			input.evidence,
			"dataQuality",
			"analyzedMatches",
			input.analyzedMatches,
			">= 20",
			score,
			"리포트 신뢰도는 분석 가능한 솔로랭크 표본 수에 좌우됩니다.",
		);
	}
	return risk(score, reasons);
}

function scoreOverall(input: {
	smurfRisk: RiskScore;
	rankMismatchRisk: RiskScore;
	derankOrThrowRisk: RiskScore;
	roleMismatchRisk: RiskScore;
	dataQualityRisk: RiskScore;
	confidence: Confidence;
}): RiskScore {
	const weighted =
		0.3 * input.smurfRisk.score +
		0.25 * input.rankMismatchRisk.score +
		0.25 * input.derankOrThrowRisk.score +
		0.1 * input.roleMismatchRisk.score +
		0.1 * input.dataQualityRisk.score;
	const primaryMax = Math.max(
		input.smurfRisk.score,
		input.rankMismatchRisk.score,
		input.derankOrThrowRisk.score,
	);
	const score = 0.55 * primaryMax + 0.45 * weighted;
	const reasons = [
		...input.smurfRisk.reasons.slice(0, 2),
		...input.rankMismatchRisk.reasons.slice(0, 2),
		...input.derankOrThrowRisk.reasons.slice(0, 2),
	];
	if (input.confidence === "LOW") reasons.push("데이터 신뢰도 낮음");
	return risk(Math.round(score), reasons);
}

function normalizeLane(participant: MatchParticipantDto): string | null {
	const lane = participant.teamPosition || participant.individualPosition;
	return VALID_LANES.has(lane) ? lane : null;
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

function confidenceFor(count: number): Confidence {
	if (count >= 50) return "HIGH";
	if (count >= 20) return "MEDIUM";
	return "LOW";
}

function recommendationFor(score: number, confidence: Confidence): Recommendation {
	if (confidence === "LOW") return score >= 45 ? "MANUAL_REVIEW" : "AUTO_PASS";
	if (score >= 80) return "REJECT_OR_INTERVIEW";
	if (score >= 40) return "MANUAL_REVIEW";
	return "AUTO_PASS";
}

function risk(score: number, reasons: string[]): RiskScore {
	const normalized = clampInt(Math.round(score), 0, 100);
	return {
		score: normalized,
		level: normalized >= 70 ? "HIGH" : normalized >= 40 ? "MEDIUM" : "LOW",
		reasons,
	};
}

function add(
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
