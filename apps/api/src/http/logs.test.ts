// /api/logs (audit log 웹뷰) 라우트 통합 테스트.

import { __resetDriver } from "@mookbot/core/test-utils/db-harness";
import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildTestApp } from "../test-utils/build-app.js";

const TEST_SECRET = "test-logs-jwt-secret-min-16chars";
const OP = "operator-uid";

beforeEach(() => {
	process.env.LOGS_JWT_SECRET = TEST_SECRET;
});
afterEach(() => {
	__resetDriver();
	delete process.env.LOGS_JWT_SECRET;
});

async function signToken(sub: string, ttlSec = 3600): Promise<string> {
	return new SignJWT({ kind: "logs" })
		.setProtectedHeader({ alg: "HS256" })
		.setSubject(sub)
		.setIssuedAt()
		.setExpirationTime(`${ttlSec}s`)
		.sign(new TextEncoder().encode(TEST_SECRET));
}

function seedAudit(db: import("@mookbot/core/test-utils/db-harness").TestDb, count = 3): void {
	db.prepare("INSERT INTO users (discord_id, display_name) VALUES (?, ?)").run(OP, "Operator");
	for (let i = 0; i < count; i++) {
		db
			.prepare(
				"INSERT INTO admin_audit_log (operator_id, action, target_type, target_id, payload) VALUES (?, ?, ?, ?, ?)",
			)
			.run(OP, "series.revert", "series", String(i), JSON.stringify({ recruitmentId: i }));
	}
}

describe("GET /api/logs (HTML + 토큰 교환)", () => {
	it("토큰 없음 + 쿠키 없음 → 401 HTML", async () => {
		const { app } = await buildTestApp();
		const res = await app.inject({ method: "GET", url: "/api/logs" });
		expect(res.statusCode).toBe(401);
		expect(res.headers["content-type"]).toContain("text/html");
		expect(res.body).toContain("인증");
	});

	it("유효 토큰 → 쿠키 set + redirect 303", async () => {
		const { app } = await buildTestApp();
		const token = await signToken(OP);
		const res = await app.inject({
			method: "GET",
			url: `/api/logs?token=${encodeURIComponent(token)}`,
		});
		expect(res.statusCode).toBe(303);
		expect(res.headers.location).toBe("/api/logs");
		const setCookie = res.headers["set-cookie"];
		expect(setCookie).toBeDefined();
		expect(String(setCookie)).toMatch(/logs_sid=/);
		expect(String(setCookie)).toMatch(/HttpOnly/);
	});

	it("무효 토큰 → 401 HTML", async () => {
		const { app } = await buildTestApp();
		const res = await app.inject({
			method: "GET",
			url: "/api/logs?token=garbage",
		});
		expect(res.statusCode).toBe(401);
	});

	it("만료 토큰 → 401 HTML", async () => {
		const { app } = await buildTestApp();
		const token = await signToken(OP, -1); // already expired
		const res = await app.inject({
			method: "GET",
			url: `/api/logs?token=${encodeURIComponent(token)}`,
		});
		expect(res.statusCode).toBe(401);
	});

	it("유효 쿠키만 → HTML 200", async () => {
		const { app } = await buildTestApp();
		const token = await signToken(OP);
		const res = await app.inject({
			method: "GET",
			url: "/api/logs",
			cookies: { logs_sid: token },
		});
		expect(res.statusCode).toBe(200);
		expect(res.headers["content-type"]).toContain("text/html");
		expect(res.body).toContain("Audit Log");
		expect(res.body).toContain(OP);
	});

	it("LOGS_JWT_SECRET 미설정 → 토큰 검증 실패 (401)", async () => {
		const { app } = await buildTestApp();
		const token = await signToken(OP);
		delete process.env.LOGS_JWT_SECRET;
		const res = await app.inject({
			method: "GET",
			url: `/api/logs?token=${encodeURIComponent(token)}`,
		});
		expect(res.statusCode).toBe(401);
	});
});

describe("GET /api/logs/data", () => {
	it("쿠키 없음 → 401 JSON", async () => {
		const { app } = await buildTestApp();
		const res = await app.inject({ method: "GET", url: "/api/logs/data" });
		expect(res.statusCode).toBe(401);
		expect(res.json()).toMatchObject({ error: "unauthenticated" });
	});

	it("쿠키 + audit 데이터 → 정렬된 row + display_name", async () => {
		const { app, db } = await buildTestApp();
		seedAudit(db, 3);
		const token = await signToken(OP);
		const res = await app.inject({
			method: "GET",
			url: "/api/logs/data",
			cookies: { logs_sid: token },
		});
		expect(res.statusCode).toBe(200);
		const body = res.json() as {
			logs: Array<{ id: number; action: string; operatorName: string; payload: string }>;
			actions: string[];
			nextCursor: number | null;
		};
		expect(body.logs).toHaveLength(3);
		expect(body.logs[0]?.id).toBeGreaterThan(body.logs[2]?.id ?? 0); // DESC
		expect(body.logs[0]?.operatorName).toBe("Operator");
		expect(body.actions).toEqual(["series.revert"]);
		expect(body.nextCursor).toBeNull();
	});

	it("limit + cursor 페이지네이션", async () => {
		const { app, db } = await buildTestApp();
		seedAudit(db, 5);
		const token = await signToken(OP);

		const first = await app.inject({
			method: "GET",
			url: "/api/logs/data?limit=2",
			cookies: { logs_sid: token },
		});
		const firstBody = first.json() as { logs: Array<{ id: number }>; nextCursor: number | null };
		expect(firstBody.logs).toHaveLength(2);
		expect(firstBody.nextCursor).toBe(firstBody.logs[1]?.id);

		const second = await app.inject({
			method: "GET",
			url: `/api/logs/data?limit=2&cursor=${firstBody.nextCursor}`,
			cookies: { logs_sid: token },
		});
		const secondBody = second.json() as { logs: Array<{ id: number }> };
		expect(secondBody.logs).toHaveLength(2);
		expect(secondBody.logs[0]?.id).toBeLessThan(firstBody.logs[1]?.id ?? 0);
	});

	it("action 필터", async () => {
		const { app, db } = await buildTestApp();
		seedAudit(db, 2);
		db
			.prepare(
				"INSERT INTO admin_audit_log (operator_id, action, target_id) VALUES (?, ?, ?)",
			)
			.run(OP, "series.force_delete", "99");
		const token = await signToken(OP);
		const res = await app.inject({
			method: "GET",
			url: "/api/logs/data?action=series.force_delete",
			cookies: { logs_sid: token },
		});
		const body = res.json() as { logs: Array<{ action: string }> };
		expect(body.logs).toHaveLength(1);
		expect(body.logs[0]?.action).toBe("series.force_delete");
	});
});

describe("POST /api/logs/logout", () => {
	it("쿠키 삭제 (Set-Cookie 만료)", async () => {
		const { app } = await buildTestApp();
		const res = await app.inject({ method: "POST", url: "/api/logs/logout" });
		expect(res.statusCode).toBe(200);
		const cookies = String(res.headers["set-cookie"] ?? "");
		// expires=Thu, 01 Jan 1970 또는 Max-Age=0 형식 — clearCookie 동작
		expect(cookies).toMatch(/logs_sid=/);
	});
});
