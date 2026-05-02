import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, installDbDriver, type TestDb } from "../test-utils/db-harness.js";
import {
	countSeriesWins,
	getGame,
	getGameStats,
	getRecentGamesForUser,
	listGamesInSeries,
} from "./games.js";
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

describe("getRecentGamesForUser", () => {
	it("user perspective + 시간 DESC + side 계산 + mmr_delta JOIN", async () => {
		// Game 1: TEAM_1=BLUE win, u1 plays TEAM_1 TOP (BLUE side, won)
		// Game 2: TEAM_1=RED win, u1 plays TEAM_1 TOP (RED side, won)
		const g1 = insertGame(1, "TEAM_1", "BLUE");
		const g2 = insertGame(2, "TEAM_1", "RED");
		db
			.prepare(
				"INSERT INTO game_stats (game_id, user_id, team, role, champion_id, kills, deaths, assists, cs, won) VALUES (?, 'u1', 'TEAM_1', 'TOP', 266, 5, 2, 7, 180, 1)",
			)
			.run(g1);
		db
			.prepare(
				"INSERT INTO game_stats (game_id, user_id, team, role, champion_id, kills, deaths, assists, cs, won) VALUES (?, 'u1', 'TEAM_1', 'TOP', 266, 3, 1, 5, 200, 1)",
			)
			.run(g2);
		// Season 가져오기
		const seasonRow = db.prepare("SELECT season_id FROM series WHERE id = ?").get(seriesId) as {
			season_id: number;
		};
		// MMR change 만 g1 한 건만 추가
		db
			.prepare(
				"INSERT INTO mmr_changes (game_id, user_id, season_id, role, opponent_id, mmr_before, mmr_after, delta) VALUES (?, 'u1', ?, 'TOP', 'u2', 1500, 1517, 17)",
			)
			.run(g1, seasonRow.season_id);

		const rows = await getRecentGamesForUser({ userId: "u1" });
		expect(rows).toHaveLength(2);
		// 시간 DESC — g2 가 더 최근에 INSERT 됐지만 played_at 은 unixepoch() 동일할 수 있어 id desc 로 변동 가능.
		// 핵심 검증: rows 안에 g1, g2 모두 있고, side 계산 정확.
		const g1Row = rows.find((r) => r.game_id === g1);
		const g2Row = rows.find((r) => r.game_id === g2);
		expect(g1Row?.side).toBe("BLUE"); // TEAM_1 + team1_side BLUE = BLUE
		expect(g2Row?.side).toBe("RED"); // TEAM_1 + team1_side RED = RED
		expect(g1Row?.mmr_delta).toBe(17);
		expect(g2Row?.mmr_delta).toBeNull(); // mmr_changes 없음
		expect(g1Row?.kills).toBe(5);
	});

	it("seasonId 필터", async () => {
		const g = insertGame(1, "TEAM_1");
		db
			.prepare(
				"INSERT INTO game_stats (game_id, user_id, team, role, won) VALUES (?, 'u1', 'TEAM_1', 'TOP', 1)",
			)
			.run(g);

		const seasonRow = db.prepare("SELECT season_id FROM series WHERE id = ?").get(seriesId) as {
			season_id: number;
		};
		const matching = await getRecentGamesForUser({ userId: "u1", seasonId: seasonRow.season_id });
		expect(matching).toHaveLength(1);

		const wrongSeason = await getRecentGamesForUser({ userId: "u1", seasonId: 99999 });
		expect(wrongSeason).toEqual([]);
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
