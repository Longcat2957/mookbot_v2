import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, installDbMock, type TestDb } from "../test-utils/db-harness.js";

vi.mock("../cloudflare/d1.js");

import { createSeason, endSeason, getCurrentSeason, getSeason } from "./seasons.js";

let db: TestDb;
beforeEach(() => {
	db = createTestDb();
	installDbMock(db);
});

describe("seasons", () => {
	it("createSeason + getSeason round-trip", async () => {
		const s = await createSeason("2025 Spring");
		expect(s.id).toBeGreaterThan(0);
		expect(s.name).toBe("2025 Spring");
		expect(s.ended_at).toBeNull();
		expect(s.started_at).toBeGreaterThan(0);

		const fetched = await getSeason(s.id);
		expect(fetched).toEqual(s);
	});

	it("getCurrentSeason 가 ended_at IS NULL 만 반환 (가장 최근)", async () => {
		const old = await createSeason("Old");
		await endSeason(old.id);
		const cur = await createSeason("Current");

		const c = await getCurrentSeason();
		expect(c?.id).toBe(cur.id);
	});

	it("getCurrentSeason undefined when 모든 시즌 종료", async () => {
		const s = await createSeason("Solo");
		await endSeason(s.id);
		expect(await getCurrentSeason()).toBeUndefined();
	});

	it("endSeason 가 ended_at 설정 + idempotent", async () => {
		const s = await createSeason("X");
		await endSeason(s.id);
		const after = await getSeason(s.id);
		expect(after?.ended_at).toBeGreaterThan(0);
		const firstEnd = after?.ended_at;

		// 두 번째 호출은 WHERE ended_at IS NULL 가드로 no-op
		await endSeason(s.id);
		const after2 = await getSeason(s.id);
		expect(after2?.ended_at).toBe(firstEnd);
	});
});
