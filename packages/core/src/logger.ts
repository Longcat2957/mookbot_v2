import path from "node:path";
import { fileURLToPath } from "node:url";
import pino from "pino";

/**
 * 애플리케이션 전역 로거.
 *
 * - 기본: pino 의 production/dev 동작 그대로 (JSON to stdout / file transport).
 * - ERROR_WEBHOOK_URL 설정 시: 추가로 error/fatal 레벨 로그를 Discord webhook 으로 push
 *   (worker thread 분리, dedupe + token bucket, 자기 자신 무한 루프 차단).
 *
 * 관련 env:
 *   ERROR_WEBHOOK_URL      필수 — Discord webhook 전체 URL
 *   ERROR_WEBHOOK_LEVEL    선택 (기본 "error", "fatal" 도 가능)
 *   ERROR_WEBHOOK_SERVICE  선택 — embed title 에 표기되는 서비스명 ("bot"/"api" 권장)
 *   LOG_LEVEL              기본 "info"
 */

const baseLevel = process.env.LOG_LEVEL ?? "info";
const webhookUrl = process.env.ERROR_WEBHOOK_URL?.trim();
const webhookLevel = process.env.ERROR_WEBHOOK_LEVEL?.trim() || "error";
const webhookService = process.env.ERROR_WEBHOOK_SERVICE?.trim() || "app";

function buildLogger() {
	if (webhookUrl) {
		const here = path.dirname(fileURLToPath(import.meta.url));
		const transport = pino.transport({
			targets: [
				{
					target: "pino/file",
					level: baseLevel,
					options: { destination: 1 },
				},
				{
					target: path.join(here, "logger-discord-transport.js"),
					level: webhookLevel,
					options: {
						webhookUrl,
						service: webhookService,
					},
				},
			],
		});
		return pino({ level: baseLevel, base: { app: "mookbot" } }, transport);
	}

	return pino({
		level: baseLevel,
		...(process.env.NODE_ENV === "production"
			? {}
			: {
					transport: {
						target: "pino/file",
						options: { destination: 1 },
					},
				}),
		base: { app: "mookbot" },
	});
}

export const log = buildLogger();
