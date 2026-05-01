// 라우트가 throw 할 수 있는 HTTP 에러. statusCode 프로퍼티는 Fastify 기본
// 에러 핸들러도 인식하지만, 우리 글로벌 핸들러 (index.ts) 가 명시적으로 사용.

import { log } from "@mookbot/core";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

export class HttpError extends Error {
	readonly statusCode: number;
	constructor(statusCode: number, message: string) {
		super(message);
		this.name = "HttpError";
		this.statusCode = statusCode;
	}
}

/**
 * Fastify 글로벌 에러 핸들러.
 * - HttpError 면 statusCode + message 그대로 반환
 * - validation error (Fastify 내장) 는 400
 * - 그 외 unexpected 는 500 + 로그 (운영자에게는 일반 메시지)
 *
 * 모든 에러는 pino 에 ERROR 로 기록 — Discord webhook 에 자동 forward.
 */
export function fastifyErrorHandler(
	err: FastifyError | Error,
	req: FastifyRequest,
	reply: FastifyReply,
): void {
	if (err instanceof HttpError) {
		// 의도된 비즈니스 에러 — info 로 (스팸 방지)
		req.log.info({ err: err.message, status: err.statusCode, url: req.url }, "http error");
		reply.code(err.statusCode).send({ error: err.message });
		return;
	}

	const fastifyErr = err as FastifyError;
	if (fastifyErr.validation) {
		reply.code(400).send({ error: fastifyErr.message, validation: fastifyErr.validation });
		return;
	}

	if (typeof fastifyErr.statusCode === "number" && fastifyErr.statusCode < 500) {
		// Fastify 내부 client error (404 등)
		reply.code(fastifyErr.statusCode).send({ error: err.message });
		return;
	}

	log.error({ err, url: req.url, method: req.method }, "unhandled api error");
	reply.code(500).send({ error: "internal server error" });
}
