import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, installDbDriver, type TestDb } from "../test-utils/db-harness.js";

import {
	getMainRiotAccount,
	getRiotAccountByPuuid,
	getRiotAccountsByUser,
	getUser,
	getUserByPuuid,
	linkRiotAccount,
	listMainRiotAccounts,
	listUsers,
	setMainRiotAccount,
	upsertRiotAccountIdentity,
	upsertUser,
} from "./users.js";

let db: TestDb;
beforeEach(() => {
	db = createTestDb();
	installDbDriver(db);
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

describe("riot account 추가 조회", () => {
	beforeEach(async () => {
		await upsertUser("u1", "Alice");
		await upsertUser("u2", "Bob");
		await linkRiotAccount({ userId: "u1", puuid: "p-1m", gameName: "M1", tagLine: "KR1" });
		await linkRiotAccount({
			userId: "u1",
			puuid: "p-1s",
			gameName: "S1",
			tagLine: "KR1",
			setMain: false,
		});
		await linkRiotAccount({ userId: "u2", puuid: "p-2m", gameName: "M2", tagLine: "NA1" });
	});

	it("getRiotAccountsByUser 정렬 (main first)", async () => {
		const list = await getRiotAccountsByUser("u1");
		expect(list).toHaveLength(2);
		expect(list[0]?.is_main).toBe(1);
		expect(list[0]?.puuid).toBe("p-1m");
		expect(list[1]?.is_main).toBe(0);
	});

	it("listMainRiotAccounts 가 다건 main 만 반환", async () => {
		const mains = await listMainRiotAccounts(["u1", "u2"]);
		expect(mains.map((m) => m.puuid).sort()).toEqual(["p-1m", "p-2m"]);
	});

	it("listMainRiotAccounts 빈 배열 → []", async () => {
		expect(await listMainRiotAccounts([])).toEqual([]);
	});

	it("getRiotAccountByPuuid + getUserByPuuid", async () => {
		expect((await getRiotAccountByPuuid("p-1m"))?.user_id).toBe("u1");
		expect((await getUserByPuuid("p-2m"))?.discord_id).toBe("u2");
		expect(await getUserByPuuid("ghost")).toBeUndefined();
	});
});

describe("upsertRiotAccountIdentity / setMainRiotAccount", () => {
	beforeEach(async () => {
		await upsertUser("u1", "Alice");
	});

	it("upsertRiotAccountIdentity — 신규는 is_main=0", async () => {
		await upsertRiotAccountIdentity({
			userId: "u1",
			puuid: "p-x",
			gameName: "X",
			tagLine: "KR1",
		});
		const a = await getRiotAccountByPuuid("p-x");
		expect(a?.is_main).toBe(0);
	});

	it("upsertRiotAccountIdentity — 기존은 is_main 안 건드림 (메인 보존)", async () => {
		await linkRiotAccount({ userId: "u1", puuid: "p-main", gameName: "M", tagLine: "KR1" });
		await upsertRiotAccountIdentity({
			userId: "u1",
			puuid: "p-main",
			gameName: "M-renamed",
			tagLine: "KR1",
		});
		const a = await getRiotAccountByPuuid("p-main");
		expect(a?.is_main).toBe(1); // 보존
		expect(a?.game_name).toBe("M-renamed");
	});

	it("setMainRiotAccount — 메인 토글", async () => {
		await linkRiotAccount({ userId: "u1", puuid: "p-1", gameName: "A", tagLine: "KR1" });
		await linkRiotAccount({
			userId: "u1",
			puuid: "p-2",
			gameName: "B",
			tagLine: "KR1",
			setMain: false,
		});
		expect((await getMainRiotAccount("u1"))?.puuid).toBe("p-1");

		await setMainRiotAccount("u1", "p-2");
		expect((await getMainRiotAccount("u1"))?.puuid).toBe("p-2");
	});

	it("setMainRiotAccount — 존재하지 않는 puuid 면 main 사라짐 (현재 구현)", async () => {
		// NOTE: JSDoc 에는 "아무 효과 없음" 이지만 실제 구현은 두 단계 batch:
		//   1) 기존 main demote (is_main=0)
		//   2) 타깃 puuid promote (matching row 없으면 0 rows)
		// → 결과: 사용자에게 main 없음. 향후 단일 트랜잭션으로 수정 검토.
		await linkRiotAccount({ userId: "u1", puuid: "p-1", gameName: "A", tagLine: "KR1" });
		await setMainRiotAccount("u1", "p-ghost");
		expect(await getMainRiotAccount("u1")).toBeUndefined();
	});
});
