// 부팅 시 env 검증 (zod). 누락된 필수 변수가 있으면 즉시 에러로 부팅 실패.
// 동작 변경 없이 fail-fast 만 추가 — 기존 process.env.X reads 는 그대로.

import { z } from "zod";

const schema = z.object({
	// Discord 봇 클라이언트 (필수)
	DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN 필수"),
	CLIENT_ID: z.string().min(1, "CLIENT_ID 필수 (deploy-commands)"),
	GUILD_ID: z.string().min(1, "GUILD_ID 필수 (guild commands)"),

	// Cloudflare D1
	CLOUDFLARE_API_TOKEN: z.string().min(1, "CLOUDFLARE_API_TOKEN 필수"),
	CF_ACCOUNT_ID: z.string().min(1, "CF_ACCOUNT_ID 필수"),
	CLOUDFLARE_D1_DATABASE_ID: z.string().min(1, "CLOUDFLARE_D1_DATABASE_ID 필수"),

	// 봇 → api notify / heartbeat
	INTERNAL_API_KEY: z.string().min(1, "INTERNAL_API_KEY 필수"),

	// /로그 슬래시 — 운영자에게 audit 뷰어 토큰 발급 시 서명. api 와 동일한 값 공유.
	// 미설정 시 /로그 명령어 비활성 (사용 시 안내 메시지).
	LOGS_JWT_SECRET: z.string().min(16, "LOGS_JWT_SECRET 최소 16자 필요").optional(),
	// /로그 응답에 표시되는 base URL. 기본 https://bot.mooklol.com.
	LOGS_BASE_URL: z.string().url().optional(),

	// Riot API (필수 — /지금게임 spectator + /전적 라이엇 룩업)
	RIOT_API_KEY: z.string().min(1, "RIOT_API_KEY 필수"),

	// 선택
	NODE_ENV: z.string().optional(),
	LOG_LEVEL: z.string().optional(),
	BOT_HEALTH_PORT: z.string().optional(),
	INTERNAL_API_BASE: z.string().optional(),
	OPERATOR_ROLE_NAME: z.string().optional(),
	ERROR_WEBHOOK_URL: z.string().url().optional(),
	ERROR_WEBHOOK_LEVEL: z.string().optional(),
	ERROR_WEBHOOK_SERVICE: z.string().optional(),
});

export function validateEnv(): void {
	const result = schema.safeParse(process.env);
	if (result.success) return;
	const issues = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
	throw new Error(`[bot] env validation failed:\n${issues}`);
}
