// 라우트 공유 헬퍼 — 인증/권한 가드, broadcast invalidate, Data Dragon URL rewrite.

import type { FastifyReply, FastifyRequest } from "fastify";
import { userCanEdit } from "../auth/perms.js";
import { broadcast } from "../ws/rooms.js";

export function invalidate(topic: string, originUser?: string): void {
	broadcast(topic, { t: "invalidate", topic, originUser });
}

// Data Dragon 절대 URL. 기본은 원본 CDN을 그대로 내려 프록시 설정/캐시 문제를 피한다.
// 필요한 환경에서만 DD_PROXY_PREFIX=/dd 처럼 지정해 same-origin 프록시를 사용한다.
const DD_ORIGIN = "https://ddragon.leagueoflegends.com";
const DD_PROXY_PREFIX = process.env.DD_PROXY_PREFIX?.replace(/\/+$/, "") ?? "";

export function rewriteDD(url: string): string {
	if (!url.startsWith(DD_ORIGIN) || !DD_PROXY_PREFIX) return url;
	return `${DD_PROXY_PREFIX}${new URL(url).pathname}`;
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

export function requireOwner(
	sid: string,
	ownerId: string | null | undefined,
	reply: FastifyReply,
): boolean {
	if (ownerId && ownerId === sid) return true;
	reply.code(403).send({
		error: "이 Activity 방을 연 사람만 화면을 조작할 수 있습니다.",
	});
	return false;
}

export async function requireOwnerOrEditor(
	req: FastifyRequest,
	reply: FastifyReply,
	ownerId: string | null | undefined,
): Promise<string | null> {
	const sid = requireSession(req, reply);
	if (!sid) return null;
	if (ownerId && ownerId === sid) return sid;
	const ok = await userCanEdit(sid);
	if (ok) return sid;
	reply.code(403).send({
		error: "이 Activity 방을 연 사람 또는 운영자(Operator) role 보유자만 조작할 수 있습니다.",
	});
	return null;
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
