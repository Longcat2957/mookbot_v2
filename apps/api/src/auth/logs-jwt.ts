// /로그 슬래시가 발급한 JWT 검증.
// 봇이 LOGS_JWT_SECRET 으로 HS256 서명, api 가 같은 secret 으로 검증.
//
// payload 구조:
//   { sub: <discord operator id>, exp, iat, kind: "logs" }
//
// 토큰 검증 후 별도의 HttpOnly 쿠키 (logs_sid) 를 set 해서 후속 요청 인증.
// 쿠키 자체도 같은 JWT 를 그대로 담는다 (별도 server-side session 미사용).

import { jwtVerify, SignJWT } from "jose";

export interface LogsJwtPayload {
	sub: string;
	kind: "logs";
	exp: number;
	iat: number;
}

function getSecretBytes(): Uint8Array | null {
	const secret = process.env.LOGS_JWT_SECRET;
	if (!secret) return null;
	return new TextEncoder().encode(secret);
}

export async function verifyLogsJwt(token: string): Promise<LogsJwtPayload | null> {
	const secret = getSecretBytes();
	if (!secret) return null;
	try {
		const { payload } = await jwtVerify<LogsJwtPayload>(token, secret, {
			algorithms: ["HS256"],
		});
		if (payload.kind !== "logs") return null;
		if (typeof payload.sub !== "string" || payload.sub.length === 0) return null;
		return payload;
	} catch {
		return null;
	}
}

/**
 * 테스트 / 내부 흐름용 — api 가 직접 토큰 발급하는 경로는 없지만 unit test 편의.
 */
export async function signLogsJwt(operatorId: string, ttlSeconds = 3600): Promise<string | null> {
	const secret = getSecretBytes();
	if (!secret) return null;
	return new SignJWT({ kind: "logs" })
		.setProtectedHeader({ alg: "HS256" })
		.setSubject(operatorId)
		.setIssuedAt()
		.setExpirationTime(`${ttlSeconds}s`)
		.sign(secret);
}
