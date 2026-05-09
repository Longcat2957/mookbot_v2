// /api/series/completed — limit / offset 페이지네이션 + total 응답 회귀 테스트.

import { __resetDriver, type TestDb } from "@mookbot/core/test-utils/db-harness";
import { afterEach, describe, expect, it } from "vitest";
import { buildTestApp, signSid } from "../test-utils/build-app.js";

afterEach(() => __resetDriver());

const OP = "operator-uid";

function seedCompletedSeries(db: TestDb, count: number): { seasonId: number } {
	const seasonId = (
		db
			.prepare("INSERT INTO seasons (name, started_at) VALUES (?, unixepoch()) RETURNING id")
			.get("S") as { id: number }
	).id;
	db.prepare("INSERT INTO users (discord_id, display_name) VALUES (?, ?)").run(OP, "Op");

	for (let i = 0; i < count; i++) {
		// ended_at 을 1씩 증가 — 정렬 검증용.
		db.prepare(
			`INSERT INTO series (season_id, status, winning_team, started_at, ended_at, created_by)
			 VALUES (?, 'COMPLETED', 'TEAM_1', ?, ?, ?)`,
		).run(seasonId, 1000 + i, 2000 + i, OP);
	}
	return { seasonId };
}

describe("GET /api/series/completed", () => {
	it("미인증 → 401", async () => {
		const { app } = await buildTestApp();
		const res = await app.inject({ method: "GET", url: "/api/series/completed" });
		expect(res.statusCode).toBe(401);
	});

	it("빈 목록 → series:[], total:0", async () => {
		const { app, db } = await buildTestApp();
		db.prepare("INSERT INTO users (discord_id, display_name) VALUES (?, ?)").run(OP, "Op");
		const res = await app.inject({
			method: "GET",
			url: "/api/series/completed",
			cookies: { sid: signSid(app, OP) },
		});
		expect(res.statusCode).toBe(200);
		const body = res.json() as { series: unknown[]; total: number };
		expect(body.series).toEqual([]);
		expect(body.total).toBe(0);
	});

	it("limit=8 + offset 페이지네이션 — 첫 페이지 8개, total 전체", async () => {
		const { app, db } = await buildTestApp();
		seedCompletedSeries(db, 20);

		const res = await app.inject({
			method: "GET",
			url: "/api/series/completed?limit=8&offset=0",
			cookies: { sid: signSid(app, OP) },
		});
		expect(res.statusCode).toBe(200);
		const body = res.json() as { series: { id: number }[]; total: number };
		expect(body.series).toHaveLength(8);
		expect(body.total).toBe(20);
	});

	it("offset=8 → 다음 페이지 8개", async () => {
		const { app, db } = await buildTestApp();
		seedCompletedSeries(db, 20);

		const res = await app.inject({
			method: "GET",
			url: "/api/series/completed?limit=8&offset=8",
			cookies: { sid: signSid(app, OP) },
		});
		expect(res.statusCode).toBe(200);
		const body = res.json() as { series: { id: number }[]; total: number };
		expect(body.series).toHaveLength(8);
		expect(body.total).toBe(20);
	});

	it("offset 이 마지막 페이지 — 남은 만큼만 반환", async () => {
		const { app, db } = await buildTestApp();
		seedCompletedSeries(db, 20);

		const res = await app.inject({
			method: "GET",
			url: "/api/series/completed?limit=8&offset=16",
			cookies: { sid: signSid(app, OP) },
		});
		expect(res.statusCode).toBe(200);
		const body = res.json() as { series: { id: number }[]; total: number };
		expect(body.series).toHaveLength(4); // 20 - 16 = 4
		expect(body.total).toBe(20);
	});

	it("offset 이 total 초과 → 빈 series, total 유지", async () => {
		const { app, db } = await buildTestApp();
		seedCompletedSeries(db, 5);

		const res = await app.inject({
			method: "GET",
			url: "/api/series/completed?limit=8&offset=100",
			cookies: { sid: signSid(app, OP) },
		});
		expect(res.statusCode).toBe(200);
		const body = res.json() as { series: { id: number }[]; total: number };
		expect(body.series).toEqual([]);
		expect(body.total).toBe(5);
	});

	it("ended_at DESC 정렬 — 최신 시리즈 위에", async () => {
		const { app, db } = await buildTestApp();
		seedCompletedSeries(db, 5); // ended_at: 2000, 2001, 2002, 2003, 2004

		const res = await app.inject({
			method: "GET",
			url: "/api/series/completed?limit=8",
			cookies: { sid: signSid(app, OP) },
		});
		expect(res.statusCode).toBe(200);
		const body = res.json() as { series: { id: number; endedAt: number }[]; total: number };
		expect(body.series.map((s) => s.endedAt)).toEqual([2004, 2003, 2002, 2001, 2000]);
	});
});
