// 라우트 공유 헬퍼 — 인증/권한 가드, broadcast invalidate, Data Dragon URL rewrite.

import type { FastifyReply, FastifyRequest } from "fastify";
import { userCanEdit } from "../auth/perms.js";
import { broadcast } from "../ws/rooms.js";

export function invalidate(topic: string, originUser?: string): void {
	broadcast(topic, { t: "invalidate", topic, originUser });
}

// Data Dragon 절대 URL 을 nginx 프록시 경로로 변환 (Activity iframe same-origin)
const DD_ORIGIN = "https://ddragon.leagueoflegends.com";

export function rewriteDD(url: string): string {
	return url.startsWith(DD_ORIGIN) ? url.replace(DD_ORIGIN, "/dd") : url;
}

export function requireSession(req: FastifyRequest, reply: FastifyReply): string | null {
	const sid = req.cookies.sid ? req.unsignCookie(req.cookies.sid) : null;
	if (!sid?.valid) {
		reply.code(401).send({ error: "unauthenticated" });
		return null;
	}
	return sid.value;
}

export async function requireEditor(
	req: FastifyRequest,
	reply: FastifyReply,
): Promise<string | null> {
	const sid = requireSession(req, reply);
	if (!sid) return null;
	const ok = await userCanEdit(sid);
	if (!ok) {
		reply.code(403).send({
			error: "쓰기 권한이 없습니다. 운영자(Operator) role 이 필요합니다.",
		});
		return null;
	}
	return sid;
}

export function requireInternalKey(req: FastifyRequest, reply: FastifyReply): boolean {
	const expected = process.env.INTERNAL_API_KEY;
	if (!expected) {
		reply.code(503).send({ error: "INTERNAL_API_KEY not configured" });
		return false;
	}
	const got = req.headers["x-internal-key"];
	if (got !== expected) {
		reply.code(401).send({ error: "invalid internal key" });
		return false;
	}
	return true;
}
