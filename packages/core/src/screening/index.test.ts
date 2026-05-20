import { afterEach, describe, expect, it, vi } from "vitest";
import { __clearRiotCacheForTest } from "../riot/client.js";
import { generateLolScreeningReport } from "./index.js";

const PUUID = "screening-puuid";

afterEach(() => {
	vi.unstubAllGlobals();
	__clearRiotCacheForTest();
});

describe("generateLolScreeningReport", () => {
	it("Riot public data를 risk score + evidence + confidence 리포트로 변환한다", async () => {
		stubRiotFetch(["m1", "m2", "m3", "m4", "m5"]);

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
		expect(report.scores.smurfRisk.reasons).toContain("소환사 레벨 50 미만");
		expect(report.evidence.some((item) => item.category === "smurf")).toBe(true);
		expect(report.recommendation).not.toBe("REJECT_OR_INTERVIEW");
	});
});

function stubRiotFetch(matchIds: string[]): void {
	process.env.RIOT_API_KEY = "test-key";
	const fetchMock = vi.fn(async (input: string | URL | Request) => {
		const url = new URL(String(input));
		if (url.pathname.includes("/riot/account/v1/accounts/by-riot-id/")) {
			return jsonResponse({ puuid: PUUID, gameName: "테스트", tagLine: "KR1" });
		}
		if (url.pathname.includes("/lol/summoner/v4/summoners/by-puuid/")) {
			return jsonResponse({ puuid: PUUID, profileIconId: 1, revisionDate: 1, summonerLevel: 30 });
		}
		if (url.pathname.includes("/lol/league/v4/entries/by-puuid/")) {
			return jsonResponse([
				{
					queueType: "RANKED_SOLO_5x5",
					tier: "SILVER",
					rank: "IV",
					leaguePoints: 20,
					wins: 10,
					losses: 5,
				},
			]);
		}
		if (url.pathname.endsWith("/ids")) {
			expect(url.searchParams.get("queue")).toBe("420");
			expect(url.searchParams.get("count")).toBe("5");
			return jsonResponse(matchIds);
		}
		const matchId = decodeURIComponent(url.pathname.split("/").at(-1) ?? "m1");
		return jsonResponse(match(matchId));
	});
	vi.stubGlobal("fetch", fetchMock);
}

function jsonResponse(body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
}

function match(matchId: string): unknown {
	return {
		metadata: { matchId },
		info: {
			gameCreation: 1_700_000_000_000,
			gameDuration: 1_800,
			gameEndTimestamp: 1_700_001_800_000,
			gameStartTimestamp: 1_700_000_000_000,
			participants: [
				{
					puuid: PUUID,
					teamPosition: "TOP",
					individualPosition: "TOP",
					championName: "Aatrox",
					win: true,
					kills: 12,
					deaths: 1,
					assists: 8,
					timePlayed: 1_800,
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
