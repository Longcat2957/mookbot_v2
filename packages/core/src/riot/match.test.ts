import { afterEach, describe, expect, it, vi } from "vitest";
import { __clearRiotCacheForTest } from "./client.js";
import { getMatch, inferMainPositionFromSoloRanked } from "./match.js";

const PUUID = "test-puuid";

afterEach(() => {
	vi.unstubAllGlobals();
	__clearRiotCacheForTest();
});

describe("inferMainPositionFromSoloRanked", () => {
	it("최근 솔랭 최대 50판을 승 3점 / 패 1점으로 계산해 60% 이상이면 해당 포지션을 반환", async () => {
		stubRiotFetch({
			m1: laneMatch("TOP", true),
			m2: laneMatch("TOP", true),
			m3: laneMatch("MIDDLE", false),
		});

		const inferred = await inferMainPositionFromSoloRanked(PUUID, 99);

		expect(inferred).toEqual({
			role: "TOP",
			sampleSize: 3,
			scores: { TOP: 6, MID: 1 },
		});
	});

	it("1등 포지션 점유율이 60% 미만이면 FLEX", async () => {
		stubRiotFetch({
			m1: laneMatch("TOP", true),
			m2: laneMatch("MIDDLE", true),
			m3: laneMatch("TOP", false),
		});

		const inferred = await inferMainPositionFromSoloRanked(PUUID);

		expect(inferred.role).toBe("FLEX");
		expect(inferred.scores).toEqual({ TOP: 4, MID: 3 });
	});

	it("1등 포지션이 동점이면 FLEX", async () => {
		stubRiotFetch({
			m1: laneMatch("TOP", true),
			m2: laneMatch("MIDDLE", true),
		});

		const inferred = await inferMainPositionFromSoloRanked(PUUID);

		expect(inferred.role).toBe("FLEX");
		expect(inferred.scores).toEqual({ TOP: 3, MID: 3 });
	});

	it("유효한 포지션 표본이 없으면 NULL 역할", async () => {
		stubRiotFetch({
			m1: laneMatch("INVALID", true),
		});

		const inferred = await inferMainPositionFromSoloRanked(PUUID);

		expect(inferred).toEqual({
			role: null,
			sampleSize: 0,
			scores: {},
		});
	});
});

describe("Riot request cache", () => {
	it("동일 URL in-flight 요청은 하나의 Riot API 호출로 합친다", async () => {
		process.env.RIOT_API_KEY = "test-key";
		const fetchMock = vi.fn(
			async () =>
				new Response(JSON.stringify({ info: { participants: [] } }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				}),
		);
		vi.stubGlobal("fetch", fetchMock);

		await Promise.all([getMatch("KR_1"), getMatch("KR_1")]);

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});

function stubRiotFetch(matches: Record<string, unknown>): void {
	process.env.RIOT_API_KEY = "test-key";
	const ids = Object.keys(matches);
	const fetchMock = vi.fn(async (input: string | URL | Request) => {
		const url = new URL(String(input));
		if (url.pathname.endsWith("/ids")) {
			expect(url.searchParams.get("count")).toBe("50");
			expect(url.searchParams.get("queue")).toBe("420");
			return jsonResponse(ids);
		}
		const matchId = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
		return jsonResponse(matches[matchId] ?? { info: { participants: [] } });
	});
	vi.stubGlobal("fetch", fetchMock);
}

function jsonResponse(body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
}

function laneMatch(teamPosition: string, win: boolean): unknown {
	return {
		info: {
			participants: [
				{
					puuid: PUUID,
					teamPosition,
					individualPosition: teamPosition,
					win,
				},
			],
		},
	};
}
