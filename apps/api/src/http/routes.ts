// HTTP 라우트 도메인별 분할 등록.
// 각 도메인 파일은 register{Domain}Routes(app) 단일 함수 export.
// 공유 헬퍼 / 인증 가드 → ./_helpers.ts. 참가자 전적 집계 → ./_history.ts.

import type { FastifyInstance } from "fastify";
import { registerAuctionMatchRoutes } from "./auction-match.js";
import { registerAuctionRecruitRoutes } from "./auction-recruit.js";
import { registerAuctionTournamentRoutes } from "./auction-tournament.js";
import { registerAuthRoutes } from "./auth.js";
import { registerBalanceSvgRoute } from "./balance-svg.js";
import { registerChampionsRoutes } from "./champions.js";
import { registerGameRoutes } from "./games.js";
import { registerHealthzRoutes } from "./healthz.js";
import { registerInternalRoutes } from "./internal.js";
import { registerLeaderboardRoutes } from "./leaderboard.js";
import { registerLogsRoutes } from "./logs.js";
import { registerMeRiotAccountsRoutes } from "./me-riot-accounts.js";
import { registerRecruitRoutes } from "./recruit.js";
import { registerScreeningRoutes } from "./screening.js";
import { registerSeriesRoutes } from "./series.js";
import { registerUsersRoutes } from "./users.js";

export async function registerRoutes(app: FastifyInstance): Promise<void> {
	await registerInternalRoutes(app);
	await registerHealthzRoutes(app);
	await registerAuthRoutes(app);
	await registerRecruitRoutes(app);
	await registerScreeningRoutes(app);
	await registerSeriesRoutes(app);
	await registerGameRoutes(app);
	await registerChampionsRoutes(app);
	await registerLeaderboardRoutes(app);
	await registerUsersRoutes(app);
	await registerMeRiotAccountsRoutes(app);
	await registerLogsRoutes(app);
	await registerBalanceSvgRoute(app);
	await registerAuctionRecruitRoutes(app);
	await registerAuctionTournamentRoutes(app);
	await registerAuctionMatchRoutes(app);
}
