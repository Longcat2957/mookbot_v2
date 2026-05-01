import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, installDbDriver, type TestDb } from "../test-utils/db-harness.js";
import { countSeriesWins, getGame, getGameStats, listGamesInSeries } from "./games.js";
import { createSeason } from "./seasons.js";
import { createSeries } from "./series.js";
import { upsertUser } from "./users.js";

let db: TestDb;
let seriesId: number;

beforeEach(async () => {
	db = createTestDb();
	installDbDriver(db);
	const s = await createSeason("Test");
	for (const id of ["op", "u1", "u2"]) await upsertUser(id, id);
	const series = await createSeries({
		seasonId: s.id,
		createdBy: "op",
		participants: [
			{ userId: "u1", team: "TEAM_1", role: "TOP" },
			{ userId: "u2", team: "TEAM_2", role: "TOP" },
		],
	});
	seriesId = series.id;
});

function insertGame(
	num: 1 | 2 | 3,
	winner: "TEAM_1" | "TEAM_2",
	side: "BLUE" | "RED" = "BLUE",
): number {
	return (
		db
			.prepare(
				"INSERT INTO games (series_id, game_number, winning_team, team1_side) VALUES (?, ?, ?, ?) RETURNING id",
			)
			.get(seriesId, num, winner, side) as { id: number }
	).id;
}

describe("getGame / listGamesInSeries", () => {
	it("getGame returns row + undefined for unknown", async () => {
		const id = insertGame(1, "TEAM_1");
		expect(await getGame(id)).toMatchObject({ id, game_number: 1, winning_team: "TEAM_1" });
		expect(await getGame(99999)).toBeUndefined();
	});

	it("listGamesInSeries 정렬 by game_number", async () => {
		insertGame(2, "TEAM_2");
		insertGame(1, "TEAM_1");
		insertGame(3, "TEAM_1");
		const list = await listGamesInSeries(seriesId);
		expect(list.map((g) => g.game_number)).toEqual([1, 2, 3]);
	});

	it("listGamesInSeries 빈 시리즈 → []", async () => {
		expect(await listGamesInSeries(seriesId)).toEqual([]);
	});
});

describe("getGameStats", () => {
	it("game_stats row 들 반환", async () => {
		const gid = insertGame(1, "TEAM_1");
		db
			.prepare(
				"INSERT INTO game_stats (game_id, user_id, team, role, won) VALUES (?, ?, 'TEAM_1', 'TOP', 1)",
			)
			.run(gid, "u1");
		db
			.prepare(
				"INSERT INTO game_stats (game_id, user_id, team, role, won) VALUES (?, ?, 'TEAM_2', 'TOP', 0)",
			)
			.run(gid, "u2");
		const stats = await getGameStats(gid);
		expect(stats).toHaveLength(2);
		expect(stats.find((s) => s.user_id === "u1")?.won).toBe(1);
	});
});

describe("countSeriesWins", () => {
	it("0:0 빈 시리즈", async () => {
		expect(await countSeriesWins(seriesId)).toEqual({ team1: 0, team2: 0 });
	});

	it("2:1 시리즈", async () => {
		insertGame(1, "TEAM_1");
		insertGame(2, "TEAM_2");
		insertGame(3, "TEAM_1");
		expect(await countSeriesWins(seriesId)).toEqual({ team1: 2, team2: 1 });
	});
});
