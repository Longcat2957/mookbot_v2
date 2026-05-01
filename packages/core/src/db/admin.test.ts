import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, installDbMock, type TestDb } from "../test-utils/db-harness.js";

vi.mock("../cloudflare/d1.js");

import { adjustLaneMmr, inspectSeasonForReset, recordAudit, resetSeasonData } from "./admin.js";
import { getLaneMmr } from "./mmr.js";
import { createSeason } from "./seasons.js";
import { upsertUser } from "./users.js";

let db: TestDb;
let seasonId: number;
const OP = "op-id";

beforeEach(async () => {
	db = createTestDb();
	installDbMock(db);
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
