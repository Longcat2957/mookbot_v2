import type { Redis } from "ioredis";
import IORedisMock from "ioredis-mock";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RedisKvStore } from "./redis.js";

let client: Redis;
let store: RedisKvStore;

beforeEach(() => {
	client = new IORedisMock() as unknown as Redis;
	store = new RedisKvStore(client);
});

afterEach(async () => {
	await client.quit();
});

describe("RedisKvStore", () => {
	it("get undefined for missing key", async () => {
		expect(await store.get("nope")).toBeUndefined();
	});

	it("set + get round-trip", async () => {
		await store.set("foo", "bar");
		expect(await store.get("foo")).toBe("bar");
	});

	it("set overwrites", async () => {
		await store.set("foo", "v1");
		await store.set("foo", "v2");
		expect(await store.get("foo")).toBe("v2");
	});

	it("set with ttlSec applies EX", async () => {
		await store.set("foo", "bar", { ttlSec: 30 });
		const ttl = await client.ttl("foo");
		expect(ttl).toBeGreaterThan(0);
		expect(ttl).toBeLessThanOrEqual(30);
	});

	it("set without ttl has no expiry", async () => {
		await store.set("foo", "bar");
		const ttl = await client.ttl("foo");
		expect(ttl).toBe(-1);
	});

	it("delete removes key", async () => {
		await store.set("foo", "bar");
		await store.delete("foo");
		expect(await store.get("foo")).toBeUndefined();
	});

	it("delete unknown key — no error", async () => {
		await expect(store.delete("ghost")).resolves.toBeUndefined();
	});

	it("updatedBy option is ignored by Redis backend", async () => {
		await store.set("foo", "bar", { updatedBy: "user-A" });
		expect(await store.get("foo")).toBe("bar");
	});
});
