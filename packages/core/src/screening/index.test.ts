import { afterEach, describe, expect, it, vi } from "vitest";
import { __clearRiotCacheForTest } from "../riot/client.js";
import { generateLolScreeningReport } from "./index.js";

const PUUID = "screening-puuid";
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

afterEach(() => {
	vi.unstubAllGlobals();
	__clearRiotCacheForTest();
});

describe("generateLolScreeningReport", () => {
	it("Riot public data를 risk score + evidence + confidence 리포트로 변환한다", async () => {
		stubRiotFetch({ matchIds: ["m1", "m2", "m3", "m4", "m5"] });

		const report = await generateLolScreeningReport({
			gameName: "테스트",
			tagLine: "KR1",
			sample: 5,
		});

		expect(report.identity).toMatchObject({
			gameName: "테스트",
			tagLine: "KR1",
			puuid: PUUID,
			region: "ASIA",
			platform: "KR",
			summonerLevel: 30,
		});
		expect(report.sample).toMatchObject({
			requestedMatches: 5,
			soloRankedMatches: 5,
			analyzedMatches: 5,
			confidence: "LOW",
		});
		expect(report.profile.currentSoloRank).toBe("SILVER IV 20LP");
		expect(report.profile.mainRoles[0]).toMatchObject({ role: "TOP", games: 5, rate: 1 });
		expect(report.profile.championPool).toBeGreaterThan(0);
		expect(report.metrics.averageKda).toBeGreaterThan(0);
		expect(report.streaks.longestWinStreak).toBe(5);
		expect(report.recentSequence.length).toBe(5);
		expect(report.timeOfDayHistogram).toHaveLength(24);
		expect(report.scores.accountTierMismatchRisk.reasons.some((r) => r.includes("소환사 레벨"))).toBe(
			true,
		);
		expect(report.evidence.some((item) => item.category === "accountTierMismatch")).toBe(true);
		expect(report.summary.headline).toContain("계정/티어");
		expect(report.recommendation).not.toBe("AUTO_PASS");
	});

	it("표본이 20 미만이면 accountConsistencyRisk를 평가하지 않는다", async () => {
		stubRiotFetch({ matchIds: ["m1", "m2", "m3", "m4", "m5"] });
		const report = await generateLolScreeningReport({
			gameName: "테스트",
			tagLine: "KR1",
			sample: 5,
		});
		expect(report.scores.accountConsistencyRisk.score).toBe(0);
		expect(report.evidence.some((item) => item.category === "accountConsistency")).toBe(false);
	});

	it("챔피언 풀이 전후로 완전히 바뀌면 accountConsistencyRisk가 발화한다", async () => {
		const matchIds = Array.from({ length: 24 }, (_, i) => `m${i}`);
		stubRiotFetch({
			matchIds,
			customizer: (matchId) => {
				const index = Number.parseInt(matchId.slice(1), 10);
				const recentHalf = index < 12;
				return {
					champion: recentHalf ? `RecentChamp${index % 6}` : `EarlierChamp${(index - 12) % 6}`,
					lane: "MIDDLE",
					playedAt: 1_700_000_000_000 - index * HOUR_MS,
					win: index % 2 === 0,
					kills: 4,
					deaths: 4,
					assists: 4,
					gameDuration: 1800,
				};
			},
		});

		const report = await generateLolScreeningReport({
			gameName: "테스트",
			tagLine: "KR1",
			sample: 24,
		});
		expect(report.scores.accountConsistencyRisk.score).toBeGreaterThanOrEqual(20);
		expect(
			report.evidence.some(
				(item) =>
					item.category === "accountConsistency" && item.metric === "championSetJaccardDistance",
			),
		).toBe(true);
	});

	it("플레이 시간대가 두 modal로 갈리면 bimodality 신호가 발화한다", async () => {
		const matchIds = Array.from({ length: 24 }, (_, i) => `m${i}`);
		const base = Date.UTC(2025, 0, 1, 0, 0, 0);
		stubRiotFetch({
			matchIds,
			customizer: (matchId) => {
				const index = Number.parseInt(matchId.slice(1), 10);
				const day = Math.floor(index / 2);
				const earlyCluster = index % 2 === 0;
				const koreaHour = earlyCluster ? 2 : 14;
				const utcHour = (koreaHour - 9 + 24) % 24;
				return {
					champion: "Aatrox",
					lane: "TOP",
					playedAt: base + day * DAY_MS + utcHour * HOUR_MS,
					win: index % 2 === 0,
					kills: 5,
					deaths: 5,
					assists: 5,
					gameDuration: 1800,
				};
			},
		});

		const report = await generateLolScreeningReport({
			gameName: "테스트",
			tagLine: "KR1",
			sample: 24,
		});
		expect(
			report.evidence.some(
				(item) => item.category === "accountConsistency" && item.metric === "playTimeBimodality",
			),
		).toBe(true);
	});

	it("일관된 KDA · 단일 챔피언 · 일정한 시간대면 accountConsistencyRisk가 낮다", async () => {
		const matchIds = Array.from({ length: 24 }, (_, i) => `m${i}`);
		const base = Date.UTC(2025, 0, 1, 11, 0, 0);
		stubRiotFetch({
			summonerLevel: 250,
			soloRankedWins: 60,
			soloRankedLosses: 55,
			matchIds,
			customizer: (matchId) => {
				const index = Number.parseInt(matchId.slice(1), 10);
				return {
					champion: "Aatrox",
					lane: "TOP",
					playedAt: base + index * DAY_MS,
					win: index % 2 === 0,
					kills: 6,
					deaths: 4,
					assists: 6,
					gameDuration: 1800,
				};
			},
		});

		const report = await generateLolScreeningReport({
			gameName: "테스트",
			tagLine: "KR1",
			sample: 24,
		});
		expect(report.scores.accountConsistencyRisk.score).toBeLessThan(40);
	});
});

interface MatchFixture {
	champion: string;
	lane: string;
	playedAt: number;
	win: boolean;
	kills: number;
	deaths: number;
	assists: number;
	gameDuration: number;
}

function stubRiotFetch(options: {
	matchIds: string[];
	summonerLevel?: number;
	soloRankedWins?: number;
	soloRankedLosses?: number;
	customizer?: (matchId: string) => MatchFixture;
}): void {
	process.env.RIOT_API_KEY = "test-key";
	const fetchMock = vi.fn(async (input: string | URL | Request) => {
		const url = new URL(String(input));
		if (url.pathname.includes("/riot/account/v1/accounts/by-riot-id/")) {
			return jsonResponse({ puuid: PUUID, gameName: "테스트", tagLine: "KR1" });
		}
		if (url.pathname.includes("/lol/summoner/v4/summoners/by-puuid/")) {
			return jsonResponse({
				puuid: PUUID,
				profileIconId: 1,
				revisionDate: 1,
				summonerLevel: options.summonerLevel ?? 30,
			});
		}
		if (url.pathname.includes("/lol/league/v4/entries/by-puuid/")) {
			return jsonResponse([
				{
					queueType: "RANKED_SOLO_5x5",
					tier: "SILVER",
					rank: "IV",
					leaguePoints: 20,
					wins: options.soloRankedWins ?? 10,
					losses: options.soloRankedLosses ?? 5,
				},
			]);
		}
		if (url.pathname.endsWith("/ids")) {
			expect(url.searchParams.get("queue")).toBe("420");
			return jsonResponse(options.matchIds);
		}
		const matchId = decodeURIComponent(url.pathname.split("/").at(-1) ?? "m1");
		const fixture = options.customizer?.(matchId);
		return jsonResponse(matchPayload(matchId, fixture));
	});
	vi.stubGlobal("fetch", fetchMock);
}

function jsonResponse(body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
}

function matchPayload(matchId: string, fixture: MatchFixture | undefined): unknown {
	const defaults: MatchFixture = {
		champion: "Aatrox",
		lane: "TOP",
		playedAt: 1_700_000_000_000,
		win: true,
		kills: 12,
		deaths: 1,
		assists: 8,
		gameDuration: 1_800,
	};
	const f = fixture ?? defaults;
	return {
		metadata: { matchId },
		info: {
			gameCreation: f.playedAt,
			gameDuration: f.gameDuration,
			gameEndTimestamp: f.playedAt,
			gameStartTimestamp: f.playedAt,
			participants: [
				{
					puuid: PUUID,
					teamPosition: f.lane,
					individualPosition: f.lane,
					championName: f.champion,
					win: f.win,
					kills: f.kills,
					deaths: f.deaths,
					assists: f.assists,
					timePlayed: f.gameDuration,
					totalMinionsKilled: 220,
					neutralMinionsKilled: 20,
					goldEarned: 15_000,
					totalDamageDealtToChampions: 30_000,
					visionScore: 25,
				},
			],
		},
	};
}
