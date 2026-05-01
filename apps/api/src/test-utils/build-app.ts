// 테스트용 Fastify app 빌더 — listen 안 함, DB 안 닿음.
// Wave 5.3: smoke + auth/operator gate 만 다룸. DB 통합은 별도 PR.
//
// canEdit 게이팅 — perms 모듈을 mock 하는 대신 env 로 자연 fallback:
//   - canEdit=true:  OPERATOR_ROLE_ID/NAME 둘 다 unset → "all users can edit"
//   - canEdit=false: OPERATOR_ROLE_ID 설정 + DISCORD_TOKEN unset → guild fetch 실패 → roles [] → false

import cookie from "@fastify/cookie";
import Fastify, { type FastifyInstance } from "fastify";
import { fastifyErrorHandler } from "../http/_errors.js";
import { registerRoutes } from "../http/routes.js";

const SESSION_SECRET = "test-secret-min-32-chars-_____padding";

export interface TestAppCtx {
	app: FastifyInstance;
}

export async function buildTestApp(opts?: { canEdit?: boolean }): Promise<TestAppCtx> {
	const canEdit = opts?.canEdit ?? true;
	if (canEdit) {
		delete process.env.OPERATOR_ROLE_ID;
		delete process.env.OPERATOR_ROLE_NAME;
	} else {
		process.env.OPERATOR_ROLE_ID = "test-operator-role";
		// DISCORD_TOKEN 없으면 fetchGuildMember → null → roles [] → canEdit false
		delete process.env.DISCORD_TOKEN;
	}

	// perms 모듈의 멤버 캐시 클리어 — 테스트 간 격리
	const { clearPermsCache } = await import("../auth/perms.js");
	clearPermsCache();

	const app = Fastify({ logger: false, trustProxy: true });
	app.setErrorHandler(fastifyErrorHandler);
	await app.register(cookie, { secret: SESSION_SECRET });
	await registerRoutes(app);

	return { app };
}

/**
 * @fastify/cookie 의 signed cookie 형식 — app.signCookie(value).
 * inject() 의 cookies 옵션에 그대로 전달.
 */
export function signSid(app: FastifyInstance, userId: string): string {
	return app.signCookie(userId);
}
