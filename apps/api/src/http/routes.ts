// HTTP 라우트 도메인별 분할 등록.
// 각 도메인 파일은 register{Domain}Routes(app) 단일 함수 export.
// 공유 헬퍼 / 인증 가드 → ./_helpers.ts. 참가자 전적 집계 → ./_history.ts.

import type { FastifyInstance } from "fastify";
import { registerAuthRoutes } from "./auth.js";
import { registerChampionsRoutes } from "./champions.js";
import { registerGameRoutes } from "./games.js";
import { registerHealthzRoutes } from "./healthz.js";
import { registerInternalRoutes } from "./internal.js";
import { registerLeaderboardRoutes } from "./leaderboard.js";
import { registerRecruitRoutes } from "./recruit.js";
import { registerSeriesRoutes } from "./series.js";
import { registerUsersRoutes } from "./users.js";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
	await registerInternalRoutes(app);
	await registerHealthzRoutes(app);
	await registerAuthRoutes(app);
	await registerRecruitRoutes(app);
	await registerSeriesRoutes(app);
	await registerGameRoutes(app);
	await registerChampionsRoutes(app);
	await registerLeaderboardRoutes(app);
	await registerUsersRoutes(app);
}
