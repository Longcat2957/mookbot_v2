import pino from "pino";

/**
 * 애플리케이션 전역 로거. 운영(production)에서는 JSON, 개발에서는 사람이 읽기 좋은 출력.
 */
export const log = pino({
	level: process.env.LOG_LEVEL ?? "info",
	...(process.env.NODE_ENV === "production"
		? {}
		: {
				transport: {
					target: "pino/file",
					options: { destination: 1 }, // stdout, plain JSON (pretty 별도 의존성 필요)
				},
			}),
	base: { app: "mookbot" },
});
