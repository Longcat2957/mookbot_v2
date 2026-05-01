// Wave 5.3 — api 라우트 통합 smoke + 인증/권한 게이트.
//
// 이 파일은 DB 안 닿는 라우트만 검증한다. DB-touching 라우트 (POST/api/series 등)
// 는 cross-package vi.mock 복잡도가 있어 별도 PR (5.3a) 로 분리.

import { afterEach, describe, expect, it, vi } from "vitest";
import { buildTestApp, signSid } from "../test-utils/build-app.js";

afterEach(() => {
	vi.resetModules();
	vi.clearAllMocks();
});

describe("smoke / health", () => {
	it("GET /healthz → 200 ok", async () => {
		const { app } = await buildTestApp();
		const res = await app.inject({ method: "GET", url: "/healthz" });
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({ ok: true });
	});

	it("GET /api/healthz/deep → 응답 형태 (200 or 503 — D1 미모킹)", async () => {
		const { app } = await buildTestApp();
		const res = await app.inject({ method: "GET", url: "/api/healthz/deep" });
		// 실제 D1 fetch 시도 (실패 → 503) 또는 startup grace 내 200.
		// 응답 구조만 검증.
		expect([200, 503]).toContain(res.statusCode);
		const body = res.json() as { ok: boolean; db: string; uptimeSec: number };
		expect(typeof body.ok).toBe("boolean");
		expect(["ok", "fail"]).toContain(body.db);
		expect(body.uptimeSec).toBeGreaterThanOrEqual(0);
	});
});

describe("session / auth", () => {
	it("GET /api/me → 401 without cookie", async () => {
		const { app } = await buildTestApp();
		const res = await app.inject({ method: "GET", url: "/api/me" });
		expect(res.statusCode).toBe(401);
	});

	it("GET /api/me → 200 with signed cookie (canEdit=true)", async () => {
		const { app } = await buildTestApp({ canEdit: true });
		const res = await app.inject({
			method: "GET",
			url: "/api/me",
			cookies: { sid: signSid(app, "user-123") },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json()).toMatchObject({ discordId: "user-123", canEdit: true });
	});

	it("GET /api/me → canEdit false when non-operator", async () => {
		const { app } = await buildTestApp({ canEdit: false });
		const res = await app.inject({
			method: "GET",
			url: "/api/me",
			cookies: { sid: signSid(app, "viewer") },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json()).toMatchObject({ discordId: "viewer", canEdit: false });
	});
});

describe("operator gate", () => {
	it("POST /api/series → 401 without cookie", async () => {
		const { app } = await buildTestApp();
		const res = await app.inject({
			method: "POST",
			url: "/api/series",
			payload: { recruitmentId: 1, assignments: [] },
		});
		expect(res.statusCode).toBe(401);
	});

	it("POST /api/series → 403 when non-operator", async () => {
		const { app } = await buildTestApp({ canEdit: false });
		const res = await app.inject({
			method: "POST",
			url: "/api/series",
			cookies: { sid: signSid(app, "viewer") },
			payload: { recruitmentId: 1, assignments: [] },
		});
		expect(res.statusCode).toBe(403);
	});
});

describe("internal endpoints", () => {
	it("POST /internal/notify → 503 without INTERNAL_API_KEY env", async () => {
		const prev = process.env.INTERNAL_API_KEY;
		process.env.INTERNAL_API_KEY = "";
		try {
			const { app } = await buildTestApp();
			const res = await app.inject({
				method: "POST",
				url: "/internal/notify",
				payload: { topic: "dashboard" },
			});
			expect(res.statusCode).toBe(503);
		} finally {
			if (prev) process.env.INTERNAL_API_KEY = prev;
			else delete process.env.INTERNAL_API_KEY;
		}
	});

	it("POST /internal/notify → 401 when key mismatch", async () => {
		process.env.INTERNAL_API_KEY = "expected-key";
		const { app } = await buildTestApp();
		const res = await app.inject({
			method: "POST",
			url: "/internal/notify",
			headers: { "x-internal-key": "wrong-key" },
			payload: { topic: "dashboard" },
		});
		expect(res.statusCode).toBe(401);
	});

	it("POST /internal/notify → 200 with correct key", async () => {
		process.env.INTERNAL_API_KEY = "correct-key";
		const { app } = await buildTestApp();
		const res = await app.inject({
			method: "POST",
			url: "/internal/notify",
			headers: { "x-internal-key": "correct-key" },
			payload: { topic: "dashboard" },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({ ok: true });
	});
});
