// 부팅 시 env 검증 (zod). 누락된 필수 변수가 있으면 즉시 에러로 부팅 실패.
// 동작 변경 없이 fail-fast 만 추가 — 기존 process.env.X reads 는 그대로.

import { z } from "zod";

const schema = z.object({
	// Cloudflare D1 (필수 — DB 접근)
	CLOUDFLARE_API_TOKEN: z.string().min(1, "CLOUDFLARE_API_TOKEN 필수"),
	CF_ACCOUNT_ID: z.string().min(1, "CF_ACCOUNT_ID 필수"),
	CLOUDFLARE_D1_DATABASE_ID: z.string().min(1, "CLOUDFLARE_D1_DATABASE_ID 필수"),

	// Discord OAuth (필수 — Activity 인증)
	CLIENT_ID: z.string().min(1, "CLIENT_ID 필수"),
	DISCORD_CLIENT_SECRET: z.string().min(1, "DISCORD_CLIENT_SECRET 필수"),
	SESSION_SECRET: z.string().min(1, "SESSION_SECRET 필수"),

	// 봇 → api heartbeat / notify 인증
	INTERNAL_API_KEY: z.string().min(1, "INTERNAL_API_KEY 필수"),

	// /로그 슬래시 → /logs 웹뷰 JWT 서명. 봇/api 공유 secret. 미설정 시 /로그 명령어 503.
	LOGS_JWT_SECRET: z.string().min(16, "LOGS_JWT_SECRET 최소 16자 필요").optional(),

	// Discord guild member fetch (perms.ts) — 운영자 role 검증에 필요
	DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN 필수 (perms guild fetch)"),
	GUILD_ID: z.string().min(1, "GUILD_ID 필수"),

	// 선택 (defaults / 기능 토글)
	NODE_ENV: z.string().optional(),
	LOG_LEVEL: z.string().optional(),
	API_HOST: z.string().optional(),
	API_PORT: z.string().optional(),
	OAUTH_REDIRECT_URI: z.string().url().optional(),
	// api → bot 내부 호출 base (compose 내부, 기본 http://bot:3001) — recruit 메시지 sync 트리거
	BOT_INTERNAL_BASE: z.string().optional(),
	OPERATOR_ROLE_ID: z.string().optional(),
	OPERATOR_ROLE_NAME: z.string().optional(),
	ERROR_WEBHOOK_URL: z.string().url().optional(),
	ERROR_WEBHOOK_LEVEL: z.string().optional(),
	ERROR_WEBHOOK_SERVICE: z.string().optional(),
});

export function validateEnv(): void {
	const result = schema.safeParse(process.env);
	if (result.success) return;
	const issues = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
	throw new Error(`[api] env validation failed:\n${issues}`);
}
