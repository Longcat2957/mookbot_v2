// recordGameAndUpdateMmr + undoLastGame — full game lifecycle 통합 테스트.

import { beforeEach, describe, expect, it } from "vitest";
import { K_FACTOR } from "../mmr/elo.js";
import { createTestDb, installDbDriver, type TestDb } from "../test-utils/db-harness.js";

import { listGamesInSeries } from "./games.js";
import { getLaneMmr, getMmrChangesForGame } from "./mmr.js";
import { recordGameAndUpdateMmr, recordGameOnly, undoLastGame } from "./record.js";
import { createSeason } from "./seasons.js";
import { createSeries, getSeries } from "./series.js";
import { upsertUser } from "./users.js";

let db: TestDb;
let seasonId: number;
let seriesId: number;

const T1 = ["t1-top", "t1-mid"];
const T2 = ["t2-top", "t2-mid"];

beforeEach(async () => {
	db = createTestDb();
	installDbDriver(db);
	const season = await createSeason("Test Season");
	seasonId = season.id;
	for (const id of [...T1, ...T2, "operator"]) await upsertUser(id, id);

	const series = await createSeries({
		seasonId,
		createdBy: "operator",
		participants: [
			{ userId: T1[0]!, team: "TEAM_1", role: "TOP" },
			{ userId: T1[1]!, team: "TEAM_1", role: "MID" },
			{ userId: T2[0]!, team: "TEAM_2", role: "TOP" },
			{ userId: T2[1]!, team: "TEAM_2", role: "MID" },
		],
	});
	seriesId = series.id;
});

describe("recordGameAndUpdateMmr", () => {
	it("happy path — game INSERT + MMR 변동 + lane MMR 갱신", async () => {
		const result = await recordGameAndUpdateMmr({
			seriesId,
			gameNumber: 1,
			winningTeam: "TEAM_1",
			team1Side: "BLUE",
			durationSec: 1800,
		});

		expect(result.game.id).toBeGreaterThan(0);
		expect(result.game.winning_team).toBe("TEAM_1");
		expect(result.mmrChanges).toHaveLength(4); // 2 라인 × 2 사이드

		// 동등 MMR (1500) 라인 매치업 → 승자 +K/2, 패자 -K/2
		const t1Top = result.mmrChanges.find((c) => c.userId === T1[0]);
		expect(t1Top?.delta).toBeCloseTo(K_FACTOR / 2, 5);
		expect(t1Top?.mmrAfter).toBeCloseTo(1500 + K_FACTOR / 2, 5);

		// user_lane_mmr 가 갱신되어 있음
		const stored = await getLaneMmr(T1[0]!, seasonId, "TOP");
		expect(stored?.mmr).toBeCloseTo(1500 + K_FACTOR / 2, 5);
		expect(stored?.games_played).toBe(1);
		expect(stored?.wins).toBe(1);

		const t2Top = await getLaneMmr(T2[0]!, seasonId, "TOP");
		expect(t2Top?.mmr).toBeCloseTo(1500 - K_FACTOR / 2, 5);
		expect(t2Top?.games_played).toBe(1);
		expect(t2Top?.wins).toBe(0);

		// mmr_changes row 도 4건 INSERT
		const changes = await getMmrChangesForGame(result.game.id);
		expect(changes).toHaveLength(4);
	});

	it("연속 2 게임 — MMR 누적", async () => {
		await recordGameAndUpdateMmr({
			seriesId,
			gameNumber: 1,
			winningTeam: "TEAM_1",
			team1Side: "BLUE",
		});
		await recordGameAndUpdateMmr({
			seriesId,
			gameNumber: 2,
			winningTeam: "TEAM_1",
			team1Side: "RED",
		});

		const t1Top = await getLaneMmr(T1[0]!, seasonId, "TOP");
		expect(t1Top?.games_played).toBe(2);
		expect(t1Top?.wins).toBe(2);
		// 첫 게임 +16 → 두번째 게임 +(약간 작은 값) — accumulation
		expect(t1Top?.mmr ?? 0).toBeGreaterThan(1500 + K_FACTOR / 2);
	});

	it("rejects 시리즈 참가자 없음", async () => {
		await expect(
			recordGameAndUpdateMmr({
				seriesId: 99999,
				gameNumber: 1,
				winningTeam: "TEAM_1",
				team1Side: "BLUE",
			}),
		).rejects.toThrow(/참가자 없음/);
	});

	it("rejects no active season", async () => {
		// 현재 시즌 종료 — getCurrentSeason 가 undefined 반환
		db.prepare("UPDATE seasons SET ended_at = unixepoch() WHERE id = ?").run(seasonId);
		await expect(
			recordGameAndUpdateMmr({
				seriesId,
				gameNumber: 1,
				winningTeam: "TEAM_1",
				team1Side: "BLUE",
			}),
		).rejects.toThrow(/no active season/);
	});
});

describe("undoLastGame", () => {
	it("최근 게임 1개 되돌림 — MMR 누적값 차감", async () => {
		await recordGameAndUpdateMmr({
			seriesId,
			gameNumber: 1,
			winningTeam: "TEAM_1",
			team1Side: "BLUE",
		});
		const before = await getLaneMmr(T1[0]!, seasonId, "TOP");
		expect(before?.games_played).toBe(1);

		const result = await undoLastGame(seriesId);
		expect(result.undoneGameNumber).toBe(1);
		expect(result.rollbackRows).toBe(4); // 라인 매치업 2 × 2 사이드
		expect(result.restoredToInProgress).toBe(false);

		const after = await getLaneMmr(T1[0]!, seasonId, "TOP");
		expect(after?.games_played).toBe(0);
		expect(after?.wins).toBe(0);
		expect(after?.mmr).toBeCloseTo(1500, 5);

		// games row 도 삭제
		expect(await listGamesInSeries(seriesId)).toEqual([]);
	});

	it("COMPLETED 시리즈 되돌리면 IN_PROGRESS 로 복구", async () => {
		await recordGameAndUpdateMmr({
			seriesId,
			gameNumber: 1,
			winningTeam: "TEAM_1",
			team1Side: "BLUE",
		});
		// 시리즈를 직접 COMPLETED 로 — undo 가 IN_PROGRESS 복구하는지 확인
		db
			.prepare("UPDATE series SET status = 'COMPLETED', winning_team = 'TEAM_1' WHERE id = ?")
			.run(seriesId);

		const result = await undoLastGame(seriesId);
		expect(result.restoredToInProgress).toBe(true);

		const s = await getSeries(seriesId);
		expect(s?.status).toBe("IN_PROGRESS");
		expect(s?.winning_team).toBeNull();
	});

	it("rejects 시리즈 없음", async () => {
		await expect(undoLastGame(99999)).rejects.toThrow(/series.*없음/);
	});

	it("rejects 되돌릴 게임 없음", async () => {
		await expect(undoLastGame(seriesId)).rejects.toThrow(/게임이 없음/);
	});

	it("rejects CANCELLED 시리즈", async () => {
		db.prepare("UPDATE series SET status = 'CANCELLED' WHERE id = ?").run(seriesId);
		await expect(undoLastGame(seriesId)).rejects.toThrow(/취소된/);
	});
});

describe("recordGameOnly — AUCTION 게임 (MMR 영향 0, 통계 통합)", () => {
	it("게임 + game_stats 만 INSERT, mmr_changes / user_lane_mmr 변동 없음", async () => {
		// AUCTION 매치를 시뮬: series.type = 'AUCTION' 으로 변경
		db.prepare("UPDATE series SET type = 'AUCTION' WHERE id = ?").run(seriesId);

		const result = await recordGameOnly({
			seriesId,
			gameNumber: 1,
			winningTeam: "TEAM_1",
			team1Side: "BLUE",
			durationSec: 1500,
			participants: [
				{ userId: T1[0]!, team: "TEAM_1", role: "TOP" },
				{ userId: T1[1]!, team: "TEAM_1", role: "MID" },
				{ userId: T2[0]!, team: "TEAM_2", role: "TOP" },
				{ userId: T2[1]!, team: "TEAM_2", role: "MID" },
			],
			stats: [
				{ userId: T1[0]!, championId: 100, kills: 5 },
				{ userId: T2[0]!, championId: 200, kills: 3 },
			],
		});

		expect(result.game.id).toBeGreaterThan(0);
		expect(result.game.winning_team).toBe("TEAM_1");

		// 격리: mmr_changes 0 행, user_lane_mmr 변동 없음 (1500 default 그대로)
		const mmrChanges = await getMmrChangesForGame(result.game.id);
		expect(mmrChanges).toHaveLength(0);

		const t1TopMmr = await getLaneMmr(T1[0]!, seasonId, "TOP");
		expect(t1TopMmr).toBeUndefined(); // 한 번도 UPSERT 안 됨

		// 통합: game_stats 는 INSERT 됨 (W/L 누적 가능)
		const stats = db
			.prepare("SELECT * FROM game_stats WHERE game_id = ? ORDER BY user_id")
			.all(result.game.id) as { user_id: string; won: 0 | 1; champion_id: number | null }[];
		expect(stats).toHaveLength(4);
		expect(stats.find((s) => s.user_id === T1[0])?.won).toBe(1);
		expect(stats.find((s) => s.user_id === T2[0])?.won).toBe(0);
		expect(stats.find((s) => s.user_id === T1[0])?.champion_id).toBe(100);
	});

	it("라인 자유 (매 게임 다른 role) — game_stats 의 role 이 input 따라감", async () => {
		db.prepare("UPDATE series SET type = 'AUCTION' WHERE id = ?").run(seriesId);

		// 게임 1: T1[0] 가 TOP
		await recordGameOnly({
			seriesId,
			gameNumber: 1,
			winningTeam: "TEAM_1",
			team1Side: "BLUE",
			participants: [
				{ userId: T1[0]!, team: "TEAM_1", role: "TOP" },
				{ userId: T1[1]!, team: "TEAM_1", role: "MID" },
				{ userId: T2[0]!, team: "TEAM_2", role: "TOP" },
				{ userId: T2[1]!, team: "TEAM_2", role: "MID" },
			],
		});

		// 게임 2: T1[0] 가 MID (라인 자유)
		await recordGameOnly({
			seriesId,
			gameNumber: 2,
			winningTeam: "TEAM_2",
			team1Side: "RED",
			participants: [
				{ userId: T1[0]!, team: "TEAM_1", role: "MID" },
				{ userId: T1[1]!, team: "TEAM_1", role: "TOP" },
				{ userId: T2[0]!, team: "TEAM_2", role: "MID" },
				{ userId: T2[1]!, team: "TEAM_2", role: "TOP" },
			],
		});

		// 사용자별 라인별 게임 수가 다름 — 통합 통계에 자연 반영
		const t1TopGames = db
			.prepare("SELECT COUNT(*) AS n FROM game_stats WHERE user_id = ? AND role = 'TOP'")
			.get(T1[0]) as { n: number };
		const t1MidGames = db
			.prepare("SELECT COUNT(*) AS n FROM game_stats WHERE user_id = ? AND role = 'MID'")
			.get(T1[0]) as { n: number };
		expect(t1TopGames.n).toBe(1);
		expect(t1MidGames.n).toBe(1);
	});
});
