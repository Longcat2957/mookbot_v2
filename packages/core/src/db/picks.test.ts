import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, installDbDriver, type TestDb } from "../test-utils/db-harness.js";
import {
	getGameBans,
	getGamePicks,
	getSeriesPicksAndBans,
	getSeriesUsedChampions,
	setGameBans,
	setGamePicks,
	validateFearless,
} from "./picks.js";
import { createSeason } from "./seasons.js";
import { createSeries } from "./series.js";
import { upsertUser } from "./users.js";

let db: TestDb;
let seasonId: number;
let seriesId: number;
let g1: number;
let g2: number;

beforeEach(async () => {
	db = createTestDb();
	installDbDriver(db);
	const s = await createSeason("Test");
	seasonId = s.id;
	for (const id of ["op", "u1", "u2"]) await upsertUser(id, id);
	const series = await createSeries({
		seasonId,
		createdBy: "op",
		participants: [
			{ userId: "u1", team: "TEAM_1", role: "TOP" },
			{ userId: "u2", team: "TEAM_2", role: "TOP" },
		],
	});
	seriesId = series.id;
	// 게임 2개 직접 INSERT (record.ts 사용 안 함 — picks 테스트 격리)
	g1 = (
		db
			.prepare(
				"INSERT INTO games (series_id, game_number, winning_team, team1_side) VALUES (?, 1, 'TEAM_1', 'BLUE') RETURNING id",
			)
			.get(seriesId) as { id: number }
	).id;
	g2 = (
		db
			.prepare(
				"INSERT INTO games (series_id, game_number, winning_team, team1_side) VALUES (?, 2, 'TEAM_2', 'RED') RETURNING id",
			)
			.get(seriesId) as { id: number }
	).id;
});

describe("setGamePicks / getGamePicks", () => {
	it("set + get round-trip", async () => {
		await setGamePicks(g1, [
			{ team: "TEAM_1", role: "TOP", championName: "Aatrox" },
			{ team: "TEAM_2", role: "TOP", championName: "Garen" },
		]);
		const rows = await getGamePicks(g1);
		expect(rows).toHaveLength(2);
		expect(rows.map((r) => r.champion_name).sort()).toEqual(["Aatrox", "Garen"]);
	});

	it("setGamePicks 가 기존 picks 모두 교체", async () => {
		await setGamePicks(g1, [{ team: "TEAM_1", role: "TOP", championName: "Old" }]);
		await setGamePicks(g1, [{ team: "TEAM_1", role: "TOP", championName: "New" }]);
		const rows = await getGamePicks(g1);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.champion_name).toBe("New");
	});

	it("setGamePicks 빈 배열 → 모두 삭제", async () => {
		await setGamePicks(g1, [{ team: "TEAM_1", role: "TOP", championName: "X" }]);
		await setGamePicks(g1, []);
		expect(await getGamePicks(g1)).toEqual([]);
	});
});

describe("setGameBans / getGameBans", () => {
	it("set + get round-trip with position", async () => {
		await setGameBans(g1, [
			{ team: "TEAM_1", position: 1, championName: "Yasuo" },
			{ team: "TEAM_1", position: 2, championName: "Zed" },
		]);
		const rows = await getGameBans(g1);
		expect(rows).toHaveLength(2);
		expect(rows.map((r) => r.position).sort()).toEqual([1, 2]);
	});

	it("setGameBans 빈 배열 → 모두 삭제", async () => {
		await setGameBans(g1, [{ team: "TEAM_1", position: 1, championName: "X" }]);
		await setGameBans(g1, []);
		expect(await getGameBans(g1)).toEqual([]);
	});
});

describe("getSeriesUsedChampions / validateFearless", () => {
	it("getSeriesUsedChampions 가 두 게임 합산", async () => {
		await setGamePicks(g1, [{ team: "TEAM_1", role: "TOP", championName: "A" }]);
		await setGamePicks(g2, [{ team: "TEAM_2", role: "TOP", championName: "B" }]);
		const used = await getSeriesUsedChampions(seriesId);
		expect(used).toEqual(new Set(["A", "B"]));
	});

	it("excludeGameId 가 해당 게임만 제외", async () => {
		await setGamePicks(g1, [{ team: "TEAM_1", role: "TOP", championName: "A" }]);
		await setGamePicks(g2, [{ team: "TEAM_2", role: "TOP", championName: "B" }]);
		const usedExcl = await getSeriesUsedChampions(seriesId, g1);
		expect(usedExcl).toEqual(new Set(["B"]));
	});

	it("validateFearless: 이전 게임과 겹침", async () => {
		await setGamePicks(g1, [{ team: "TEAM_1", role: "TOP", championName: "Aatrox" }]);
		const violations = await validateFearless(seriesId, [
			{ team: "TEAM_2", role: "TOP", championName: "Aatrox" },
		]);
		expect(violations).toHaveLength(1);
		expect(violations[0]?.reason).toBe("previous_game");
	});

	it("validateFearless: 입력 자체 중복", async () => {
		const violations = await validateFearless(seriesId, [
			{ team: "TEAM_1", role: "TOP", championName: "Aatrox" },
			{ team: "TEAM_2", role: "TOP", championName: "Aatrox" },
		]);
		expect(violations).toHaveLength(1);
		expect(violations[0]?.reason).toBe("duplicate_in_input");
	});

	it("validateFearless: 통과", async () => {
		await setGamePicks(g1, [{ team: "TEAM_1", role: "TOP", championName: "A" }]);
		const violations = await validateFearless(seriesId, [
			{ team: "TEAM_1", role: "TOP", championName: "B" },
			{ team: "TEAM_2", role: "TOP", championName: "C" },
		]);
		expect(violations).toEqual([]);
	});
});

describe("getSeriesPicksAndBans", () => {
	it("Bo3 통합 — game_number 순 정렬", async () => {
		await setGamePicks(g2, [{ team: "TEAM_1", role: "TOP", championName: "G2" }]);
		await setGamePicks(g1, [{ team: "TEAM_1", role: "TOP", championName: "G1" }]);
		await setGameBans(g1, [{ team: "TEAM_1", position: 1, championName: "B1" }]);

		const { picks, bans } = await getSeriesPicksAndBans(seriesId);
		expect(picks.map((p) => p.champion_name)).toEqual(["G1", "G2"]);
		expect(bans.map((b) => b.champion_name)).toEqual(["B1"]);
	});
});
