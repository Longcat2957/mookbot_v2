import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, installDbDriver, type TestDb } from "../test-utils/db-harness.js";
import { getUserChampionPreferences, setUserLaneChampionPreferences } from "./preferences.js";
import { upsertUser } from "./users.js";

let db: TestDb;
beforeEach(async () => {
	db = createTestDb();
	installDbDriver(db);
	await upsertUser("u1", "Alice");
	await upsertUser("u2", "Bob");
});

describe("getUserChampionPreferences", () => {
	it("빈 사용자 → []", async () => {
		expect(await getUserChampionPreferences("u1")).toEqual([]);
	});

	it("저장 후 라인/포지션 순으로 반환", async () => {
		await setUserLaneChampionPreferences({ userId: "u1", role: "TOP", championIds: [266, 85] });
		await setUserLaneChampionPreferences({ userId: "u1", role: "MID", championIds: [103] });

		const rows = await getUserChampionPreferences("u1");
		expect(rows).toHaveLength(3);
		// MID 가 알파벳 순으로 TOP 보다 앞 — ORDER BY role 은 단순 문자열 정렬.
		// 핵심은 라인 묶음 안에서 position 순으로 나오는 것.
		const top = rows.filter((r) => r.role === "TOP");
		expect(top.map((r) => r.champion_id)).toEqual([266, 85]);
		expect(top.map((r) => r.position)).toEqual([0, 1]);
	});

	it("다른 사용자 풀과 격리", async () => {
		await setUserLaneChampionPreferences({ userId: "u1", role: "TOP", championIds: [266] });
		await setUserLaneChampionPreferences({ userId: "u2", role: "TOP", championIds: [85] });

		const rows1 = await getUserChampionPreferences("u1");
		expect(rows1).toHaveLength(1);
		expect(rows1[0]?.champion_id).toBe(266);
	});
});

describe("setUserLaneChampionPreferences", () => {
	it("교체 — 기존 풀 삭제 후 새 풀 INSERT", async () => {
		await setUserLaneChampionPreferences({ userId: "u1", role: "TOP", championIds: [1, 2, 3] });
		await setUserLaneChampionPreferences({ userId: "u1", role: "TOP", championIds: [4, 5] });

		const top = (await getUserChampionPreferences("u1")).filter((r) => r.role === "TOP");
		expect(top.map((r) => r.champion_id)).toEqual([4, 5]);
		expect(top.map((r) => r.position)).toEqual([0, 1]);
	});

	it("빈 배열 — 해당 라인만 전체 삭제, 다른 라인 영향 X", async () => {
		await setUserLaneChampionPreferences({ userId: "u1", role: "TOP", championIds: [1, 2] });
		await setUserLaneChampionPreferences({ userId: "u1", role: "MID", championIds: [3] });

		await setUserLaneChampionPreferences({ userId: "u1", role: "TOP", championIds: [] });

		const all = await getUserChampionPreferences("u1");
		expect(all).toHaveLength(1);
		expect(all[0]?.role).toBe("MID");
		expect(all[0]?.champion_id).toBe(3);
	});

	it("중복 챔프 ID 입력 → 첫 발견만 유지 (de-dup)", async () => {
		await setUserLaneChampionPreferences({
			userId: "u1",
			role: "TOP",
			championIds: [10, 20, 10, 30, 20],
		});
		const top = (await getUserChampionPreferences("u1")).filter((r) => r.role === "TOP");
		expect(top.map((r) => r.champion_id)).toEqual([10, 20, 30]);
		expect(top.map((r) => r.position)).toEqual([0, 1, 2]);
	});

	it("user 삭제 시 CASCADE", async () => {
		await setUserLaneChampionPreferences({ userId: "u1", role: "TOP", championIds: [1, 2] });
		db.prepare("DELETE FROM users WHERE discord_id = ?").run("u1");
		expect(await getUserChampionPreferences("u1")).toEqual([]);
	});
});
