// /api/series/:id/balance.svg 통합 테스트.

import { __resetDriver, type TestDb } from "@mookbot/core/test-utils/db-harness";
import { afterEach, describe, expect, it } from "vitest";
import { buildTestApp, signSid } from "../test-utils/build-app.js";

afterEach(() => __resetDriver());

const OP = "operator-uid";

function seedSeries(db: TestDb): { seasonId: number; seriesId: number } {
	const seasonId = (
		db
			.prepare("INSERT INTO seasons (name, started_at) VALUES (?, unixepoch()) RETURNING id")
			.get("Test") as { id: number }
	).id;
	for (const [id, name] of [
		[OP, "Operator"],
		["u1", "Alice"],
		["u2", "Bob"],
	] as const) {
		db.prepare("INSERT INTO users (discord_id, display_name) VALUES (?, ?)").run(id, name);
	}
	const seriesId = (
		db
			.prepare("INSERT INTO series (season_id, created_by) VALUES (?, ?) RETURNING id")
			.get(seasonId, OP) as { id: number }
	).id;
	db
		.prepare(
			"INSERT INTO series_participants (series_id, user_id, team, role) VALUES (?, ?, 'TEAM_1', 'TOP')",
		)
		.run(seriesId, "u1");
	db
		.prepare(
			"INSERT INTO series_participants (series_id, user_id, team, role) VALUES (?, ?, 'TEAM_2', 'TOP')",
		)
		.run(seriesId, "u2");
	// MMR row 1개 (u1만) — u2 는 default 1500 fallback
	db
		.prepare(
			"INSERT INTO user_lane_mmr (user_id, season_id, role, mmr, games_played, wins, updated_at) VALUES (?, ?, 'TOP', 1620, 4, 3, unixepoch())",
		)
		.run("u1", seasonId);
	return { seasonId, seriesId };
}

describe("GET /api/series/:id/balance.svg", () => {
	it("미인증 → 401", async () => {
		const { app } = await buildTestApp();
		const res = await app.inject({ method: "GET", url: "/api/series/1/balance.svg" });
		expect(res.statusCode).toBe(401);
	});

	it("invalid id → 400", async () => {
		const { app } = await buildTestApp();
		const res = await app.inject({
			method: "GET",
			url: "/api/series/abc/balance.svg",
			cookies: { sid: signSid(app, OP) },
		});
		expect(res.statusCode).toBe(400);
	});

	it("not found → 404", async () => {
		const { app } = await buildTestApp();
		const res = await app.inject({
			method: "GET",
			url: "/api/series/9999/balance.svg",
			cookies: { sid: signSid(app, OP) },
		});
		expect(res.statusCode).toBe(404);
	});

	it("정상 응답 — image/svg+xml + 핵심 텍스트 포함", async () => {
		const { app, db } = await buildTestApp();
		const { seriesId } = seedSeries(db);
		const res = await app.inject({
			method: "GET",
			url: `/api/series/${seriesId}/balance.svg?side=BLUE`,
			cookies: { sid: signSid(app, OP) },
		});
		expect(res.statusCode).toBe(200);
		expect(res.headers["content-type"]).toContain("image/svg+xml");
		expect(res.headers["cache-control"]).toBe("no-store");

		const body = res.body;
		expect(body).toContain("<svg");
		expect(body).toContain(`시리즈 #${seriesId}`);
		expect(body).toContain("1팀 · BLUE");
		expect(body).toContain("2팀 · RED");
		expect(body).toContain("Alice");
		expect(body).toContain("Bob");
		expect(body).toContain("1620"); // u1 MMR
		expect(body).toContain("1500"); // u2 default MMR
		expect(body).toContain("TOP");
	});

	it("side=RED → 1팀 RED, 2팀 BLUE", async () => {
		const { app, db } = await buildTestApp();
		const { seriesId } = seedSeries(db);
		const res = await app.inject({
			method: "GET",
			url: `/api/series/${seriesId}/balance.svg?side=RED`,
			cookies: { sid: signSid(app, OP) },
		});
		expect(res.statusCode).toBe(200);
		expect(res.body).toContain("1팀 · RED");
		expect(res.body).toContain("2팀 · BLUE");
	});

	it("side 미지정 → BLUE 기본", async () => {
		const { app, db } = await buildTestApp();
		const { seriesId } = seedSeries(db);
		const res = await app.inject({
			method: "GET",
			url: `/api/series/${seriesId}/balance.svg`,
			cookies: { sid: signSid(app, OP) },
		});
		expect(res.body).toContain("1팀 · BLUE");
	});

	it("XML escape — 닉네임의 < > & 처리", async () => {
		const { app, db } = await buildTestApp();
		const { seriesId } = seedSeries(db);
		// u1 닉네임 변경 → < script > 시도
		db.prepare("UPDATE users SET display_name = ? WHERE discord_id = ?").run(
			"<script>",
			"u1",
		);
		const res = await app.inject({
			method: "GET",
			url: `/api/series/${seriesId}/balance.svg`,
			cookies: { sid: signSid(app, OP) },
		});
		expect(res.statusCode).toBe(200);
		// raw < script > 가 그대로 박히면 안 됨
		expect(res.body).not.toContain("<script>");
		expect(res.body).toContain("&lt;script&gt;");
	});
});
