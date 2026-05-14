import { beforeEach, describe, expect, it, vi } from "vitest";
import { RoutedKvStore } from "./routed.js";
import type { KvStore } from "./types.js";

class StubKvStore implements KvStore {
	store = new Map<string, string>();
	getSpy = vi.fn();
	setSpy = vi.fn();
	delSpy = vi.fn();

	async get(k: string) {
		this.getSpy(k);
		return this.store.get(k);
	}
	async set(k: string, v: string) {
		this.setSpy(k, v);
		this.store.set(k, v);
	}
	async delete(k: string) {
		this.delSpy(k);
		this.store.delete(k);
	}
}

let redis: StubKvStore;
let d1: StubKvStore;
let routed: RoutedKvStore;

beforeEach(() => {
	redis = new StubKvStore();
	d1 = new StubKvStore();
	routed = new RoutedKvStore(redis, d1);
});

describe("RoutedKvStore prefix routing", () => {
	it.each([
		["entry:123", "redis"],
		["pickban:456", "redis"],
		["cache:leaderboard", "redis"],
		["config:guild:9", "d1"],
		["random-key", "d1"],
	])("%s routes to %s", async (key, target) => {
		await routed.set(key, "v");
		const expected = target === "redis" ? redis : d1;
		const other = target === "redis" ? d1 : redis;
		expect(expected.setSpy).toHaveBeenCalledWith(key, "v");
		expect(other.setSpy).not.toHaveBeenCalled();
	});

	it("get follows same routing", async () => {
		await redis.set("entry:99", "from-redis");
		await d1.set("entry:99", "from-d1");
		expect(await routed.get("entry:99")).toBe("from-redis");
	});

	it("delete follows same routing", async () => {
		await redis.set("pickban:1", "x");
		await d1.set("pickban:1", "y");
		await routed.delete("pickban:1");
		expect(redis.store.has("pickban:1")).toBe(false);
		expect(d1.store.has("pickban:1")).toBe(true);
	});

	it("ttl options passed through", async () => {
		await routed.set("entry:7", "v", { ttlSec: 60 });
		expect(redis.setSpy).toHaveBeenCalledWith("entry:7", "v");
	});
});
