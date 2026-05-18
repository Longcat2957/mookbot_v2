import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, installDbDriver, type TestDb } from "../test-utils/db-harness.js";
import {
	countLeaderboard,
	getCompositeLeaderboard,
	getLaneMmrs,
	getLeaderboard,
	getMmrChangesForGame,
	getMmrChangesForUser,
	getMmrHistoryForUser,
} from "./mmr.js";
import { createSeason } from "./seasons.js";
import { softDeleteUser, upsertUser } from "./users.js";

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

	it("soft-deleted user 제외", async () => {
		expect(await softDeleteUser("u1")).toBe(1);

		const lb = await getLeaderboard(seasonId, "TOP");
		expect(lb.map((r) => r.user_id)).toEqual(["u2"]);
		expect(await countLeaderboard(seasonId, "TOP")).toBe(1);
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
					"INSERT INTO games (ranked_series_id, game_number, winning_team, team1_side) VALUES (?, 1, 'TEAM_1', 'BLUE') RETURNING id",
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
			db.prepare("SELECT id FROM games WHERE ranked_series_id = ?").get(seriesId.id) as { id: number }
		).id;
		const changes = await getMmrChangesForGame(gameId);
		expect(changes).toHaveLength(2);
		expect(changes.map((c) => c.user_id).sort()).toEqual(["u1", "u2"]);
	});

	it("getMmrHistoryForUser 시간 ASC + 시즌·라인 필터", async () => {
		const u1 = await getMmrHistoryForUser({ userId: "u1", seasonId, role: "TOP" });
		expect(u1).toHaveLength(1);
		expect(u1[0]?.delta).toBe(16);

		const u1Mid = await getMmrHistoryForUser({ userId: "u1", seasonId, role: "MID" });
		expect(u1Mid).toEqual([]);
	});
});

describe("getCompositeLeaderboard", () => {
	it("가중평균 MMR DESC, games_played ≥ 1 만, 멀티 라인 합산", async () => {
		// u1 추가: MID 1400, 5G — TOP 1700×5 + MID 1400×5 / 10 = 1550 (가중)
		db
			.prepare(
				"INSERT INTO user_lane_mmr (user_id, season_id, role, mmr, games_played, wins, updated_at) VALUES ('u1', ?, 'MID', 1400, 5, 2, unixepoch())",
			)
			.run(seasonId);
		// u2 는 TOP 만 1500×3 — 가중평균 = 1500
		// u3 는 0G 라 제외

		const lb = await getCompositeLeaderboard(seasonId);
		expect(lb.map((r) => r.user_id)).toEqual(["u1", "u2"]);
		expect(Math.round(lb[0]?.weighted_mmr ?? 0)).toBe(1550);
		expect(lb[0]?.total_games).toBe(10);
		expect(lb[1]?.weighted_mmr).toBe(1500);
		expect(lb[1]?.total_games).toBe(3);
	});

	it("soft-deleted user 제외", async () => {
		await softDeleteUser("u1");

		const lb = await getCompositeLeaderboard(seasonId);
		expect(lb.map((r) => r.user_id)).toEqual(["u2"]);
	});
});
