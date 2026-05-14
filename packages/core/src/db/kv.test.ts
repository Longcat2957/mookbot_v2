import { beforeEach, describe, expect, it } from "vitest";
import { D1KvStore } from "../kv/d1.js";
import { __setKvStoreForTest } from "../kv/factory.js";
import { createTestDb, installDbDriver, type TestDb } from "../test-utils/db-harness.js";
import { deleteKv, getKv, setKv } from "./kv.js";

let db: TestDb;
beforeEach(() => {
	db = createTestDb();
	installDbDriver(db);
	// facade → D1KvStore 강제. REDIS_URL 누설로 인한 Redis 시도 차단.
	__setKvStoreForTest(new D1KvStore());
});

describe("guild_kv", () => {
	it("getKv undefined for missing key", async () => {
		expect(await getKv("foo")).toBeUndefined();
	});

	it("setKv + getKv round-trip", async () => {
		await setKv("foo", "bar");
		expect(await getKv("foo")).toBe("bar");
	});

	it("setKv overwrites (UPSERT)", async () => {
		await setKv("foo", "v1");
		await setKv("foo", "v2");
		expect(await getKv("foo")).toBe("v2");
	});

	it("setKv updatedBy persisted", async () => {
		await setKv("foo", "bar", "user-A");
		const row = db.prepare("SELECT updated_by FROM guild_kv WHERE k = ?").get("foo") as {
			updated_by: string;
		};
		expect(row.updated_by).toBe("user-A");
	});

	it("setKv without updatedBy → NULL", async () => {
		await setKv("foo", "bar");
		const row = db.prepare("SELECT updated_by FROM guild_kv WHERE k = ?").get("foo") as {
			updated_by: string | null;
		};
		expect(row.updated_by).toBeNull();
	});

	it("deleteKv removes row", async () => {
		await setKv("foo", "bar");
		await deleteKv("foo");
		expect(await getKv("foo")).toBeUndefined();
	});

	it("deleteKv unknown key — no error", async () => {
		await expect(deleteKv("ghost")).resolves.toBeUndefined();
	});
});
