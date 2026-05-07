// OAuth2 (Discord Embedded App SDK) — token exchange + 세션 발급 + 본인 권한 조회.

import type { FastifyInstance } from "fastify";
import { diagnosePerms, userCanEdit } from "../auth/perms.js";
import { requireSession } from "./_helpers.js";

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
	// OAuth2 token exchange — Activity SDK authorize() 의 code 를 access_token 으로 교환
	// (Discord Embedded App SDK 표준 흐름: authorize → /api/token → authenticate)
	app.post<{ Body: { code: string } }>("/api/token", async (req, reply) => {
		const { code } = req.body ?? {};
		if (!code) return reply.code(400).send({ error: "code required" });

		const clientId = process.env.CLIENT_ID;
		const clientSecret = process.env.DISCORD_CLIENT_SECRET;
		if (!clientId || !clientSecret) {
			return reply.code(500).send({ error: "CLIENT_ID / DISCORD_CLIENT_SECRET unset" });
		}

		const params = new URLSearchParams({
			client_id: clientId,
			client_secret: clientSecret,
			grant_type: "authorization_code",
			code,
			redirect_uri: process.env.OAUTH_REDIRECT_URI ?? "https://bot.mooklol.com",
		});
		const res = await fetch("https://discord.com/api/oauth2/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: params,
		});
		if (!res.ok) {
			const text = await res.text();
			req.log.warn({ status: res.status, text }, "token exchange failed");
			return reply.code(401).send({ error: "token exchange failed" });
		}
		const { access_token } = (await res.json()) as { access_token: string };
		return { access_token };
	});

	// OAuth2 세션 발급 — Activity SDK authenticate() 후 access_token 으로 사용자 검증
	app.post<{ Body: { access_token: string } }>("/api/session", async (req, reply) => {
		const { access_token } = req.body ?? {};
		if (!access_token) return reply.code(400).send({ error: "access_token required" });

		const res = await fetch("https://discord.com/api/users/@me", {
			headers: { Authorization: `Bearer ${access_token}` },
		});
		if (!res.ok) return reply.code(401).send({ error: "invalid token" });
		const user = (await res.json()) as { id: string; username: string };

		reply.setCookie("sid", user.id, {
			path: "/",
			httpOnly: true,
			secure: true,
			sameSite: "none",
			signed: true,
			maxAge: 60 * 60 * 24,
		});
		return { user };
	});

	app.get("/api/me", async (req, reply) => {
		const sid = requireSession(req, reply);
		if (!sid) return;
		const canEdit = await userCanEdit(sid);
		return {
			discordId: sid,
			canEdit,
		};
	});

	// 권한 진단 — 본인 권한 상태 확인용 (운영자 디버그 화면에 노출 가능)
	app.get("/api/me/perms", async (req, reply) => {
		const sid = requireSession(req, reply);
		if (!sid) return;
		return diagnosePerms(sid);
	});
}
