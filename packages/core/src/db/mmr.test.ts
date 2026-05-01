import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, installDbDriver, type TestDb } from "../test-utils/db-harness.js";
import {
	countLeaderboard,
	getLaneMmrs,
	getLeaderboard,
	getMmrChangesForGame,
	getMmrChangesForUser,
} from "./mmr.js";
import { createSeason } from "./seasons.js";
import { upsertUser } from "./users.js";

let db: TestDb;
let seasonId: number;

beforeEach(async () => {
	db = createTestDb();
	installDbDriver(db);
	const s = await createSeason("Test");
	seasonId = s.id;
	for (const id of ["u1", "u2", "u3", "op"]) await upsertUser(id, id);

	// fixture: 3 users, TOP role, varying mmr + games_played
	db
		.prepare(
			"INSERT INTO user_lane_mmr (user_id, season_id, role, mmr, games_played, wins, updated_at) VALUES ('u1', ?, 'TOP', 1700, 5, 4, unixepoch())",
		)
		.run(seasonId);
	db
		.prepare(
			"INSERT INTO user_lane_mmr (user_id, season_id, role, mmr, games_played, wins, updated_at) VALUES ('u2', ?, 'TOP', 1500, 3, 1, unixepoch())",
		)
		.run(seasonId);
	db
		.prepare(
			"INSERT INTO user_lane_mmr (user_id, season_id, role, mmr, games_played, wins, updated_at) VALUES ('u3', ?, 'TOP', 2000, 0, 0, unixepoch())",
		)
		.run(seasonId); // games_played=0 → leaderboard 제외
});

describe("getLaneMmrs (다건 lookup)", () => {
	it("일치하는 (user, role) 페어만 반환", async () => {
		const rows = await getLaneMmrs(
			[
				{ userId: "u1", role: "TOP" },
				{ userId: "u2", role: "TOP" },
				{ userId: "u1", role: "MID" }, // 없음
			],
			seasonId,
		);
		expect(rows).toHaveLength(2);
		expect(rows.map((r) => r.user_id).sort()).toEqual(["u1", "u2"]);
	});

	it("빈 입력 → []", async () => {
		expect(await getLaneMmrs([], seasonId)).toEqual([]);
	});
});

describe("getLeaderboard / countLeaderboard", () => {
	it("MMR DESC + games_played > 0 만 (u3 제외)", async () => {
		const lb = await getLeaderboard(seasonId, "TOP");
		expect(lb.map((r) => r.user_id)).toEqual(["u1", "u2"]);
	});

	it("limit + offset", async () => {
		const lb = await getLeaderboard(seasonId, "TOP", 1, 0);
		expect(lb).toHaveLength(1);
		expect(lb[0]?.user_id).toBe("u1");

		const lb2 = await getLeaderboard(seasonId, "TOP", 1, 1);
		expect(lb2[0]?.user_id).toBe("u2");
	});

	it("countLeaderboard 반영 (games_played > 0)", async () => {
		expect(await countLeaderboard(seasonId, "TOP")).toBe(2);
		expect(await countLeaderboard(seasonId, "MID")).toBe(0);
	});
});

describe("getMmrChangesForUser / getMmrChangesForGame", () => {
	beforeEach(() => {
		// games + mmr_changes fixture
		const seriesId = (
			db
				.prepare("INSERT INTO series (season_id, created_by) VALUES (?, 'op') RETURNING id")
				.get(seasonId) as { id: number }
		).id;
		const g1 = (
			db
				.prepare(
					"INSERT INTO games (series_id, game_number, winning_team, team1_side) VALUES (?, 1, 'TEAM_1', 'BLUE') RETURNING id",
				)
				.get(seriesId) as { id: number }
		).id;
		db
			.prepare(
				"INSERT INTO mmr_changes (game_id, user_id, season_id, role, opponent_id, mmr_before, mmr_after, delta) VALUES (?, 'u1', ?, 'TOP', 'u2', 1700, 1716, 16)",
			)
			.run(g1, seasonId);
		db
			.prepare(
				"INSERT INTO mmr_changes (game_id, user_id, season_id, role, opponent_id, mmr_before, mmr_after, delta) VALUES (?, 'u2', ?, 'TOP', 'u1', 1500, 1484, -16)",
			)
			.run(g1, seasonId);
	});

	it("getMmrChangesForUser 가 user 별 변동만", async () => {
		const u1 = await getMmrChangesForUser("u1");
		expect(u1).toHaveLength(1);
		expect(u1[0]?.delta).toBe(16);
	});

	it("getMmrChangesForGame 가 game 의 모든 row", async () => {
		const seriesId = db.prepare("SELECT id FROM series LIMIT 1").get() as { id: number };
		const gameId = (
			db.prepare("SELECT id FROM games WHERE series_id = ?").get(seriesId.id) as { id: number }
		).id;
		const changes = await getMmrChangesForGame(gameId);
		expect(changes).toHaveLength(2);
		expect(changes.map((c) => c.user_id).sort()).toEqual(["u1", "u2"]);
	});
});
