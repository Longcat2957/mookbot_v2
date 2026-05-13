import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, installDbDriver, type TestDb } from "../test-utils/db-harness.js";

import {
	adjustLaneMmr,
	forceDeleteSeriesWithRollback,
	inspectSeasonForReset,
	inspectSeriesForDelete,
	listAuditActions,
	listAuditLog,
	pruneAuditLog,
	recordAudit,
	resetSeasonData,
} from "./admin.js";
import { getLaneMmr } from "./mmr.js";
import { createSeason } from "./seasons.js";
import { upsertUser } from "./users.js";

let db: TestDb;
let seasonId: number;
const OP = "op-id";

beforeEach(async () => {
	db = createTestDb();
	installDbDriver(db);
	const s = await createSeason("Test");
	seasonId = s.id;
	await upsertUser(OP, "Operator");
});

describe("recordAudit", () => {
	it("insert + payload JSON 직렬화", async () => {
		await recordAudit({
			operatorId: OP,
			action: "test.action",
			targetType: "user",
			targetId: "u1",
			payload: { foo: 1, bar: "baz" },
			note: "manual",
		});
		const rows = db.prepare("SELECT * FROM admin_audit_log").all() as Array<{
			operator_id: string;
			action: string;
			target_type: string;
			target_id: string;
			payload: string;
			note: string;
		}>;
		expect(rows).toHaveLength(1);
		expect(rows[0]?.operator_id).toBe(OP);
		expect(rows[0]?.action).toBe("test.action");
		expect(rows[0]?.target_type).toBe("user");
		expect(rows[0]?.target_id).toBe("u1");
		expect(JSON.parse(rows[0]?.payload ?? "{}")).toEqual({ foo: 1, bar: "baz" });
		expect(rows[0]?.note).toBe("manual");
	});

	it("optional 필드 모두 NULL", async () => {
		await recordAudit({ operatorId: OP, action: "minimal" });
		const rows = db.prepare("SELECT * FROM admin_audit_log").all() as Array<{
			target_type: string | null;
			target_id: string | null;
			payload: string | null;
			note: string | null;
		}>;
		expect(rows[0]?.target_type).toBeNull();
		expect(rows[0]?.target_id).toBeNull();
		expect(rows[0]?.payload).toBeNull();
		expect(rows[0]?.note).toBeNull();
	});
});

describe("listAuditLog / listAuditActions", () => {
	beforeEach(async () => {
		// 2개 액션 5건씩 — id 가 1..10 (insert 순)
		for (let i = 0; i < 5; i++) {
			await recordAudit({ operatorId: OP, action: "series.revert", targetId: String(i) });
		}
		for (let i = 0; i < 5; i++) {
			await recordAudit({ operatorId: "op2", action: "series.force_delete", targetId: String(i) });
		}
	});

	it("기본 — 최신순, limit 50", async () => {
		const rows = await listAuditLog();
		expect(rows).toHaveLength(10);
		expect(rows[0]?.id).toBe(10);
		expect(rows[9]?.id).toBe(1);
	});

	it("action 필터", async () => {
		const rows = await listAuditLog({ action: "series.revert" });
		expect(rows).toHaveLength(5);
		expect(rows.every((r) => r.action === "series.revert")).toBe(true);
	});

	it("operatorId 필터", async () => {
		const rows = await listAuditLog({ operatorId: "op2" });
		expect(rows).toHaveLength(5);
		expect(rows.every((r) => r.operator_id === "op2")).toBe(true);
	});

	it("cursor 페이지네이션 — id < cursor", async () => {
		const first = await listAuditLog({ limit: 4 });
		expect(first.map((r) => r.id)).toEqual([10, 9, 8, 7]);
		const cursor = first[first.length - 1]?.id ?? 0;
		const second = await listAuditLog({ limit: 4, cursor });
		expect(second.map((r) => r.id)).toEqual([6, 5, 4, 3]);
	});

	it("listAuditActions 가 distinct 정렬", async () => {
		const actions = await listAuditActions();
		expect(actions).toEqual(["series.force_delete", "series.revert"]);
	});
});

describe("pruneAuditLog", () => {
	it("cutoff 이전 row 삭제 + count 반환, 이후 row 보존", async () => {
		const now = Math.floor(Date.now() / 1000);
		const NINETY_DAYS = 90 * 86400;
		const oldTs = now - 100 * 86400; // 100일 전 — 삭제 대상
		const recentTs = now - 30 * 86400; // 30일 전 — 보존

		const insert = db.prepare(
			`INSERT INTO admin_audit_log (operator_id, action, created_at) VALUES (?, ?, ?)`,
		);
		for (let i = 0; i < 60; i++) insert.run(OP, "old.entry", oldTs);
		for (let i = 0; i < 40; i++) insert.run(OP, "recent.entry", recentTs);

		const { deleted } = await pruneAuditLog(now - NINETY_DAYS);
		expect(deleted).toBe(60);

		const remaining = db.prepare("SELECT COUNT(*) AS n FROM admin_audit_log").get() as {
			n: number;
		};
		expect(remaining.n).toBe(40);
	});

	it("매칭 row 0 일 때 deleted 0", async () => {
		await recordAudit({ operatorId: OP, action: "fresh" });
		const { deleted } = await pruneAuditLog(0);
		expect(deleted).toBe(0);
		const remaining = db.prepare("SELECT COUNT(*) AS n FROM admin_audit_log").get() as {
			n: number;
		};
		expect(remaining.n).toBe(1);
	});

	it("정확히 cutoff 와 같은 created_at 은 보존 (< 비교)", async () => {
		const cutoff = 1_000_000;
		db
			.prepare(`INSERT INTO admin_audit_log (operator_id, action, created_at) VALUES (?, ?, ?)`)
			.run(OP, "edge", cutoff);
		const { deleted } = await pruneAuditLog(cutoff);
		expect(deleted).toBe(0);
	});
});

describe("adjustLaneMmr", () => {
	beforeEach(async () => {
		await upsertUser("user-A", "Alice");
	});

	it("최초 호출 — baseline 1500 + delta", async () => {
		const r = await adjustLaneMmr({
			userId: "user-A",
			seasonId,
			role: "TOP",
			delta: 50,
		});
		expect(r.before).toBe(1500);
		expect(r.after).toBe(1550);

		const stored = await getLaneMmr("user-A", seasonId, "TOP");
		expect(stored?.mmr).toBe(1550);
	});

	it("기존 row + delta — 누적", async () => {
		await adjustLaneMmr({ userId: "user-A", seasonId, role: "MID", delta: 100 });
		const r = await adjustLaneMmr({
			userId: "user-A",
			seasonId,
			role: "MID",
			delta: -30,
		});
		expect(r.before).toBe(1600);
		expect(r.after).toBe(1570);
	});

	it("음수 delta", async () => {
		const r = await adjustLaneMmr({
			userId: "user-A",
			seasonId,
			role: "BOTTOM",
			delta: -200,
		});
		expect(r.after).toBe(1300);
	});

	it("라인별 독립 — TOP 변경이 MID row 에 영향 X", async () => {
		await adjustLaneMmr({ userId: "user-A", seasonId, role: "TOP", delta: 100 });
		// MID 는 row 가 없음 — getLaneMmr → undefined
		expect(await getLaneMmr("user-A", seasonId, "MID")).toBeUndefined();
		// TOP 만 영향
		expect((await getLaneMmr("user-A", seasonId, "TOP"))?.mmr).toBe(1600);
	});
});

describe("inspectSeasonForReset", () => {
	it("빈 시즌은 0/0/0/0", async () => {
		const summary = await inspectSeasonForReset(seasonId);
		expect(summary).toEqual({
			seasonId,
			seriesCount: 0,
			gamesCount: 0,
			mmrChangesCount: 0,
			laneMmrCount: 0,
		});
	});

	it("user_lane_mmr 있을 때 count 반영", async () => {
		await upsertUser("u1", "U1");
		await adjustLaneMmr({ userId: "u1", seasonId, role: "TOP", delta: 0 });
		await adjustLaneMmr({ userId: "u1", seasonId, role: "MID", delta: 0 });

		const summary = await inspectSeasonForReset(seasonId);
		expect(summary.laneMmrCount).toBe(2);
		expect(summary.seriesCount).toBe(0);
	});
});

describe("resetSeasonData", () => {
	it("모든 시즌 데이터 삭제 (lane MMR 포함)", async () => {
		await upsertUser("u1", "U1");
		await adjustLaneMmr({ userId: "u1", seasonId, role: "TOP", delta: 100 });
		expect((await getLaneMmr("u1", seasonId, "TOP"))?.mmr).toBe(1600);

		const summary = await resetSeasonData(seasonId);
		expect(summary.laneMmrCount).toBe(1);

		const after = await inspectSeasonForReset(seasonId);
		expect(after.laneMmrCount).toBe(0);
	});
});

describe("inspectSeriesForDelete + forceDeleteSeriesWithRollback", () => {
	async function setupSeriesWithGame(): Promise<{ seriesId: number; gameId: number }> {
		await upsertUser("u1", "U1");
		await upsertUser("u2", "U2");
		const seriesRow = db
			.prepare("INSERT INTO series (season_id, created_by) VALUES (?, ?) RETURNING id")
			.get(seasonId, OP) as { id: number };
		const sid = seriesRow.id;
		db
			.prepare(
				"INSERT INTO series_participants (series_id, user_id, team, role) VALUES (?, ?, 'TEAM_1', 'TOP')",
			)
			.run(sid, "u1");
		db
			.prepare(
				"INSERT INTO series_participants (series_id, user_id, team, role) VALUES (?, ?, 'TEAM_2', 'TOP')",
			)
			.run(sid, "u2");
		const gameRow = db
			.prepare(
				"INSERT INTO games (ranked_series_id, game_number, winning_team, team1_side) VALUES (?, 1, 'TEAM_1', 'BLUE') RETURNING id",
			)
			.get(sid) as { id: number };
		const gid = gameRow.id;
		// MMR change row + lane mmr 직접 INSERT (record.ts 우회)
		db
			.prepare(
				`INSERT INTO mmr_changes (game_id, user_id, season_id, role, opponent_id, mmr_before, mmr_after, delta) VALUES (?, ?, ?, 'TOP', ?, 1500, 1516, 16)`,
			)
			.run(gid, "u1", seasonId, "u2");
		db
			.prepare(
				`INSERT INTO mmr_changes (game_id, user_id, season_id, role, opponent_id, mmr_before, mmr_after, delta) VALUES (?, ?, ?, 'TOP', ?, 1500, 1484, -16)`,
			)
			.run(gid, "u2", seasonId, "u1");
		db
			.prepare(
				"INSERT INTO user_lane_mmr (user_id, season_id, role, mmr, games_played, wins, updated_at) VALUES (?, ?, 'TOP', 1516, 1, 1, unixepoch())",
			)
			.run("u1", seasonId);
		db
			.prepare(
				"INSERT INTO user_lane_mmr (user_id, season_id, role, mmr, games_played, wins, updated_at) VALUES (?, ?, 'TOP', 1484, 1, 0, unixepoch())",
			)
			.run("u2", seasonId);
		return { seriesId: sid, gameId: gid };
	}

	it("inspectSeriesForDelete — counts + rollbackPlan 집계", async () => {
		const { seriesId } = await setupSeriesWithGame();
		const inspect = await inspectSeriesForDelete(seriesId);
		expect(inspect.gamesCount).toBe(1);
		expect(inspect.participants).toBe(2);
		expect(inspect.mmrChanges).toBe(2);
		expect(inspect.rollbackPlan).toHaveLength(2);
		const u1Plan = inspect.rollbackPlan.find((p) => p.userId === "u1");
		expect(u1Plan?.totalDelta).toBe(16);
		expect(u1Plan?.gamesPlayed).toBe(1);
		expect(u1Plan?.wins).toBe(1);
	});

	it("forceDeleteSeriesWithRollback rollback=true → mmr 차감 + series soft-delete", async () => {
		const { seriesId } = await setupSeriesWithGame();
		const result = await forceDeleteSeriesWithRollback(seriesId, true);

		expect(result.rollbackRows).toBe(2);
		// soft-delete: 행은 남아있고 deleted_at 만 set
		const row = db.prepare("SELECT deleted_at FROM series WHERE id = ?").get(seriesId) as
			| { deleted_at: number | null }
			| undefined;
		expect(row).toBeDefined();
		expect(row?.deleted_at).not.toBeNull();
		// MMR 차감 — u1: 1516 - 16 = 1500
		expect((await getLaneMmr("u1", seasonId, "TOP"))?.mmr).toBe(1500);
		// u2: 1484 - (-16) = 1500
		expect((await getLaneMmr("u2", seasonId, "TOP"))?.mmr).toBe(1500);
	});

	it("forceDeleteSeriesWithRollback rollback=false → mmr 그대로 + series soft-delete", async () => {
		const { seriesId } = await setupSeriesWithGame();
		const result = await forceDeleteSeriesWithRollback(seriesId, false);

		expect(result.rollbackRows).toBe(0);
		// MMR 안 건드림
		expect((await getLaneMmr("u1", seasonId, "TOP"))?.mmr).toBe(1516);
		// 시리즈는 soft-delete
		const row = db.prepare("SELECT deleted_at FROM series WHERE id = ?").get(seriesId) as
			| { deleted_at: number | null }
			| undefined;
		expect(row).toBeDefined();
		expect(row?.deleted_at).not.toBeNull();
	});

	it("subsequentGames=0 일 때 0 반환", async () => {
		const { seriesId } = await setupSeriesWithGame();
		const inspect = await inspectSeriesForDelete(seriesId);
		expect(inspect.subsequentGames).toBe(0);

		const result = await forceDeleteSeriesWithRollback(seriesId, true);
		expect(result.subsequentGames).toBe(0);
		expect(result.gamesCount).toBe(1);
		expect(result.participants).toBe(2);
		expect(result.mmrChanges).toBe(2);
	});

	it("후속 시리즈가 있으면 subsequentGames 누적 — drift 위험 audit 노출용", async () => {
		// S1: u1 vs u2 TOP (setupSeriesWithGame 가 만든 것)
		const { seriesId: s1Id } = await setupSeriesWithGame();
		// S2: u1 이 같은 라인에서 한 게임 더 — S1 의 영향을 받은 (u1, season, TOP) 후속
		const s2 = db
			.prepare("INSERT INTO series (season_id, created_by) VALUES (?, ?) RETURNING id")
			.get(seasonId, OP) as { id: number };
		await upsertUser("u3", "U3");
		db
			.prepare(
				"INSERT INTO series_participants (series_id, user_id, team, role) VALUES (?, ?, 'TEAM_1', 'TOP')",
			)
			.run(s2.id, "u1");
		db
			.prepare(
				"INSERT INTO series_participants (series_id, user_id, team, role) VALUES (?, ?, 'TEAM_2', 'TOP')",
			)
			.run(s2.id, "u3");
		const g2 = db
			.prepare(
				"INSERT INTO games (ranked_series_id, game_number, winning_team, team1_side) VALUES (?, 1, 'TEAM_1', 'BLUE') RETURNING id",
			)
			.get(s2.id) as { id: number };
		db
			.prepare(
				`INSERT INTO mmr_changes (game_id, user_id, season_id, role, opponent_id, mmr_before, mmr_after, delta) VALUES (?, ?, ?, 'TOP', ?, 1516, 1530, 14)`,
			)
			.run(g2.id, "u1", seasonId, "u3");
		db
			.prepare(
				`INSERT INTO mmr_changes (game_id, user_id, season_id, role, opponent_id, mmr_before, mmr_after, delta) VALUES (?, ?, ?, 'TOP', ?, 1500, 1486, -14)`,
			)
			.run(g2.id, "u3", seasonId, "u1");

		// S1 강제 삭제 — u1 의 후속 게임 1건이 subsequentGames 로 노출돼야 함.
		// u2 는 후속 없음. 그래도 u1 의 1건만 카운트 (u3 는 S1 의 영향 받은 user 가 아니므로).
		const result = await forceDeleteSeriesWithRollback(s1Id, true);
		expect(result.subsequentGames).toBe(1);
		expect(result.rollbackRows).toBe(2);
	});
});
