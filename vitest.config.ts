import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: [
			// 테스트는 source 경로로 통일 — api 가 import 하는 @mookbot/core 가
			// dist/ 가 아닌 src/ 모듈을 가리키게 해야 driver swap 이 같은 모듈
			// 인스턴스에 적용됨. subpath 도 매핑.
			{
				find: /^@mookbot\/core\/test-utils\/db-harness$/,
				replacement: path.resolve(here, "packages/core/src/test-utils/db-harness.ts"),
			},
			{
				find: /^@mookbot\/core$/,
				replacement: path.resolve(here, "packages/core/src/index.ts"),
			},
		],
	},
	test: {
		include: ["**/*.{test,spec}.{ts,tsx}"],
		exclude: ["**/node_modules/**", "**/dist/**", "**/.svelte-kit/**"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
			include: ["packages/core/src/**", "apps/*/src/**"],
			exclude: [
				"**/*.test.ts",
				"**/*.spec.ts",
				"**/*.d.ts",
				"**/*.sql",
				"**/dist/**",
				"**/index.ts",
				"**/types.ts",
				// CLI 스크립트 — 운영자 직접 실행, 단위테스트 ROI 낮음
				"packages/core/src/db/seed.ts",
				"packages/core/src/db/migrate.ts",
				"packages/core/src/db/dump.ts",
				"packages/core/src/db/reset.ts",
				"packages/core/src/db/restore.ts",
				"packages/core/src/db/backup.ts",
				"packages/core/src/db/_assert.ts",
				"apps/bot/src/deploy-commands.ts",
				// React UI / Discord 인터랙션 — 단위테스트 비효율 (E2E 영역).
				// 단, 화면 상태 hook (use*State.ts) 은 도메인 로직 비중이 높아 별도 cover.
				"apps/activity/src/**",
				"!apps/activity/src/screens/*/use*State.ts",
				"apps/bot/src/commands/**",
				"apps/bot/src/events/**",
				"apps/bot/src/webhooks/**",
				"apps/bot/src/healthServer.ts",
				"apps/bot/src/heartbeat.ts",
				"apps/bot/src/index.ts",
				"apps/bot/src/utils/**",
				// 부팅 / 외부 통신
				"packages/core/src/cloudflare/d1.ts",
				"packages/core/src/datadragon/**",
				"packages/core/src/riot/**",
				"packages/core/src/logger.ts",
				"packages/core/src/logger-discord-transport.ts",
				"apps/api/src/index.ts",
				"apps/api/src/env.ts",
				"apps/bot/src/env.ts",
				"apps/api/src/auth/**",
				"apps/api/src/test-utils/**",
				"apps/api/src/ws/**",
				"apps/api/src/http/healthz.ts",
				"apps/api/src/http/_errors.ts",
				"apps/api/src/http/_helpers.ts",
				"apps/api/src/http/_history.ts",
				"apps/api/src/http/auth.ts",
				"apps/api/src/http/champions.ts",
				"apps/api/src/http/games.ts",
				"apps/api/src/http/internal.ts",
				"apps/api/src/http/recruit.ts",
				"apps/api/src/http/routes.ts",
				"apps/api/src/http/series.ts",
				"packages/core/src/test-utils/**",
			],
		},
	},
});
