// 테스트용 Fastify app 빌더 — listen 안 함, in-memory SQLite + 모킹.
//
// canEdit 게이팅 — perms 모듈의 명시적 테스트 override 훅 사용.
//   - canEdit=true:  __setCanEditOverrideForTest(true) → 모든 사용자 허용
//   - canEdit=false: __setCanEditOverrideForTest(false) → 모든 사용자 거부
// production 코드 경로는 영향 없음 (override 는 테스트 파일에서만 set).

import cookie from "@fastify/cookie";
import { createTestDb, installDbDriver, type TestDb } from "@mookbot/core/test-utils/db-harness";
import Fastify, { type FastifyInstance } from "fastify";
import { fastifyErrorHandler } from "../http/_errors.js";
import { registerRoutes } from "../http/routes.js";

const SESSION_SECRET = "test-secret-min-32-chars-_____padding";

export interface TestAppCtx {
	app: FastifyInstance;
	db: TestDb;
}

export async function buildTestApp(opts?: { canEdit?: boolean }): Promise<TestAppCtx> {
	const canEdit = opts?.canEdit ?? true;

	// perms 모듈 — 테스트 override + 캐시 클리어
	const { __setCanEditOverrideForTest, clearPermsCache } = await import("../auth/perms.js");
	__setCanEditOverrideForTest(canEdit);
	clearPermsCache();

	// In-memory SQLite + d1 driver swap → 모든 db.* 호출이 SQLite 위에서 실행
	const db = createTestDb();
	installDbDriver(db);

	const app = Fastify({ logger: false, trustProxy: true });
	app.setErrorHandler(fastifyErrorHandler);
	await app.register(cookie, { secret: SESSION_SECRET });
	await registerRoutes(app);

	return { app, db };
}

/**
 * @fastify/cookie 의 signed cookie 형식 — app.signCookie(value).
 * inject() 의 cookies 옵션에 그대로 전달.
 */
export function signSid(app: FastifyInstance, userId: string): string {
	return app.signCookie(userId);
}
