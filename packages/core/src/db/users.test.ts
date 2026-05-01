import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, installDbMock, type TestDb } from "../test-utils/db-harness.js";

vi.mock("../cloudflare/d1.js");

import { getMainRiotAccount, getUser, linkRiotAccount, listUsers, upsertUser } from "./users.js";

let db: TestDb;
beforeEach(() => {
	db = createTestDb();
	installDbMock(db);
});

describe("upsertUser", () => {
	it("INSERT 신규 사용자", async () => {
		await upsertUser("u1", "Alice");
		const u = await getUser("u1");
		expect(u?.display_name).toBe("Alice");
	});

	it("UPDATE 기존 사용자 (display_name 다른 경우만)", async () => {
		await upsertUser("u1", "Alice");
		await upsertUser("u1", "Alice2");
		const u = await getUser("u1");
		expect(u?.display_name).toBe("Alice2");
	});

	it("같은 displayName 재호출은 no-op", async () => {
		await upsertUser("u1", "Alice");
		const before = await getUser("u1");
		await upsertUser("u1", "Alice"); // WHERE display_name <> excluded → 미트리거
		const after = await getUser("u1");
		expect(after?.created_at).toBe(before?.created_at);
	});

	it("getUser undefined for unknown id", async () => {
		expect(await getUser("ghost")).toBeUndefined();
	});

	it("listUsers 가 IN clause 로 다건 조회", async () => {
		await upsertUser("a", "Alice");
		await upsertUser("b", "Bob");
		await upsertUser("c", "Carol");

		const rows = await listUsers(["a", "c", "z"]);
		expect(rows.map((u) => u.discord_id).sort()).toEqual(["a", "c"]);
	});

	it("listUsers 빈 배열 → []", async () => {
		expect(await listUsers([])).toEqual([]);
	});
});

describe("linkRiotAccount", () => {
	beforeEach(async () => {
		await upsertUser("u1", "Alice");
	});

	it("신규 link 가 main 으로 저장", async () => {
		await linkRiotAccount({
			userId: "u1",
			puuid: "p-aaa",
			gameName: "Faker",
			tagLine: "KR1",
		});
		const main = await getMainRiotAccount("u1");
		expect(main?.puuid).toBe("p-aaa");
		expect(main?.is_main).toBe(1);
		expect(main?.game_name).toBe("Faker");
	});

	it("두 번째 link (setMain=true 기본) 가 이전 main 강등", async () => {
		await linkRiotAccount({
			userId: "u1",
			puuid: "p-aaa",
			gameName: "Old",
			tagLine: "KR1",
		});
		await linkRiotAccount({
			userId: "u1",
			puuid: "p-bbb",
			gameName: "New",
			tagLine: "NA1",
		});
		const main = await getMainRiotAccount("u1");
		expect(main?.puuid).toBe("p-bbb");
	});

	it("setMain=false 면 기존 main 유지", async () => {
		await linkRiotAccount({
			userId: "u1",
			puuid: "p-aaa",
			gameName: "Main",
			tagLine: "KR1",
		});
		await linkRiotAccount({
			userId: "u1",
			puuid: "p-bbb",
			gameName: "Alt",
			tagLine: "NA1",
			setMain: false,
		});
		const main = await getMainRiotAccount("u1");
		expect(main?.puuid).toBe("p-aaa");
	});

	it("같은 puuid 재link → name/tag 갱신 (UPSERT)", async () => {
		await linkRiotAccount({
			userId: "u1",
			puuid: "p-aaa",
			gameName: "Old",
			tagLine: "KR1",
		});
		await linkRiotAccount({
			userId: "u1",
			puuid: "p-aaa",
			gameName: "Renamed",
			tagLine: "KR1",
		});
		const main = await getMainRiotAccount("u1");
		expect(main?.game_name).toBe("Renamed");
	});
});
