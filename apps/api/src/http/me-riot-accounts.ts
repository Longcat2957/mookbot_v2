// 본인 라이엇 계정 self-service CRUD.
//
// 모든 엔드포인트는 세션 사용자 (sid = discord_id) 본인의 행만 조회/수정 가능.
// 운영자 권한 무관 — 누구나 자기 계정만 관리. WHERE user_id = sid 가드 강제.
//
// 4개 audit action: riot_account.linked, riot_account.unlinked,
// riot_account.main_changed, riot_account.refreshed.

import { datadragon, db, riot } from "@mookbot/core";
import type { FastifyInstance } from "fastify";
import { invalidate, requireSession, rewriteDD } from "./_helpers.js";

interface RiotAccountResponse {
	puuid: string;
	gameName: string;
	tagLine: string;
	isMain: boolean;
	profileIconUrl: string | null;
}

function toResponse(row: {
	puuid: string;
	game_name: string;
	tag_line: string;
	is_main: 0 | 1;
	profile_icon_id: number | null;
}): RiotAccountResponse {
	return {
		puuid: row.puuid,
		gameName: row.game_name,
		tagLine: row.tag_line,
		isMain: row.is_main === 1,
		profileIconUrl:
			row.profile_icon_id != null
				? rewriteDD(datadragon.getProfileIconUrl(row.profile_icon_id))
				: null,
	};
}

export async function registerMeRiotAccountsRoutes(app: FastifyInstance): Promise<void> {
	// 본인 라이엇 계정 전체 — main first 정렬.
	app.get("/api/me/riot-accounts", async (req, reply) => {
		const sid = requireSession(req, reply);
		if (!sid) return;
		const rows = await db.getRiotAccountsByUser(sid);
		return { accounts: rows.map(toResponse) };
	});

	// 신규 라이엇 계정 link — Riot API 검증 + profile_icon fetch + INSERT.
	// 첫 계정이면 자동 메인, 그 외는 sub 로 추가 (메인 위치 유지).
	app.post<{ Body: { riotId?: string } }>("/api/me/riot-accounts", async (req, reply) => {
		const sid = requireSession(req, reply);
		if (!sid) return;

		const riotIdInput = req.body?.riotId?.trim();
		if (!riotIdInput) {
			return reply.code(400).send({ error: "riotId 가 필요합니다 (GameName#TagLine 형식)" });
		}
		try {
			riot.parseRiotId(riotIdInput);
		} catch {
			return reply.code(400).send({ error: "라이엇 ID 형식이 잘못되었습니다 (예: GameName#TagLine)" });
		}

		// Riot API 로 puuid + 정식 명칭 확인.
		let account: { puuid: string; gameName: string; tagLine: string };
		try {
			account = await riot.getAccountByRiotId(riotIdInput);
		} catch (err) {
			req.log.warn({ err, riotIdInput, sid }, "riot account lookup failed");
			return reply.code(404).send({
				error: `라이엇 서버에서 ${riotIdInput} 를 찾지 못했습니다.`,
			});
		}

		// PUUID 가 다른 사용자에게 이미 연결되어 있으면 거부.
		const existing = await db.getRiotAccountByPuuid(account.puuid);
		if (existing && existing.user_id !== sid) {
			return reply.code(409).send({
				error: "이 라이엇 계정은 이미 다른 디스코드 사용자에게 연결되어 있습니다.",
			});
		}

		// profile_icon_id — Summoner-V4 호출 실패해도 link 자체는 진행.
		let profileIconId: number | null = null;
		try {
			const summoner = await riot.getSummonerByPuuid(account.puuid);
			profileIconId = summoner.profileIconId;
		} catch (err) {
			req.log.warn({ err, puuid: account.puuid }, "summoner fetch failed (continuing)");
		}

		// 첫 계정 여부 확인 — 첫 계정만 자동 메인.
		const before = await db.getRiotAccountsByUser(sid);
		const isFirst = before.length === 0;

		await db.linkRiotAccount({
			userId: sid,
			puuid: account.puuid,
			gameName: account.gameName,
			tagLine: account.tagLine,
			setMain: isFirst,
			profileIconId,
		});

		await db.recordAudit({
			operatorId: sid,
			action: "riot_account.linked",
			targetType: "riot_account",
			targetId: account.puuid,
			payload: {
				gameName: account.gameName,
				tagLine: account.tagLine,
				setMain: isFirst,
			},
		});
		invalidate(`user:${sid}`, sid);

		const fresh = await db.getRiotAccountByPuuid(account.puuid);
		return { account: fresh ? toResponse(fresh) : null };
	});

	// Riot 계정 연결 해제 — 메인이든 sub 든 무조건 삭제. auto-promote 없음.
	app.delete<{ Params: { puuid: string } }>(
		"/api/me/riot-accounts/:puuid",
		async (req, reply) => {
			const sid = requireSession(req, reply);
			if (!sid) return;

			const puuid = req.params.puuid;
			if (!puuid) return reply.code(400).send({ error: "puuid required" });

			// 삭제 전 행 확보 (audit payload 용)
			const target = await db.getRiotAccountByPuuid(puuid);
			if (!target || target.user_id !== sid) {
				return reply.code(404).send({ error: "본인의 라이엇 계정 중에서 찾을 수 없습니다." });
			}

			const changed = await db.unlinkRiotAccount(sid, puuid);
			if (changed === 0) {
				return reply.code(404).send({ error: "이미 삭제된 계정입니다." });
			}

			await db.recordAudit({
				operatorId: sid,
				action: "riot_account.unlinked",
				targetType: "riot_account",
				targetId: puuid,
				payload: {
					gameName: target.game_name,
					tagLine: target.tag_line,
					wasMain: target.is_main === 1,
				},
			});
			invalidate(`user:${sid}`, sid);
			return { ok: true };
		},
	);

	// 메인 전환 — 기존 메인 demote + 지정 puuid promote.
	app.put<{ Params: { puuid: string } }>(
		"/api/me/riot-accounts/:puuid/main",
		async (req, reply) => {
			const sid = requireSession(req, reply);
			if (!sid) return;

			const puuid = req.params.puuid;
			const target = await db.getRiotAccountByPuuid(puuid);
			if (!target || target.user_id !== sid) {
				return reply.code(404).send({ error: "본인의 라이엇 계정 중에서 찾을 수 없습니다." });
			}
			if (target.is_main === 1) {
				return { ok: true, alreadyMain: true };
			}

			await db.setMainRiotAccount(sid, puuid);
			await db.recordAudit({
				operatorId: sid,
				action: "riot_account.main_changed",
				targetType: "riot_account",
				targetId: puuid,
				payload: {
					gameName: target.game_name,
					tagLine: target.tag_line,
				},
			});
			invalidate(`user:${sid}`, sid);
			return { ok: true };
		},
	);

	// Riot API 로 game_name / tag_line / profile_icon_id 재동기화 — Riot ID 변경 추적용.
	app.post<{ Params: { puuid: string } }>(
		"/api/me/riot-accounts/:puuid/refresh",
		async (req, reply) => {
			const sid = requireSession(req, reply);
			if (!sid) return;

			const puuid = req.params.puuid;
			const before = await db.getRiotAccountByPuuid(puuid);
			if (!before || before.user_id !== sid) {
				return reply.code(404).send({ error: "본인의 라이엇 계정 중에서 찾을 수 없습니다." });
			}

			let account: { puuid: string; gameName: string; tagLine: string };
			try {
				account = await riot.getAccountByPuuid(puuid);
			} catch (err) {
				req.log.warn({ err, puuid }, "account by puuid lookup failed");
				return reply.code(502).send({ error: "라이엇 API 조회 실패" });
			}

			let profileIconId: number | null = null;
			try {
				const summoner = await riot.getSummonerByPuuid(puuid);
				profileIconId = summoner.profileIconId;
			} catch (err) {
				req.log.warn({ err, puuid }, "summoner fetch failed (continuing)");
			}

			// is_main 보존 — identity 만 갱신.
			await db.upsertRiotAccountIdentity({
				userId: sid,
				puuid,
				gameName: account.gameName,
				tagLine: account.tagLine,
				profileIconId,
			});

			await db.recordAudit({
				operatorId: sid,
				action: "riot_account.refreshed",
				targetType: "riot_account",
				targetId: puuid,
				payload: {
					before: { gameName: before.game_name, tagLine: before.tag_line },
					after: { gameName: account.gameName, tagLine: account.tagLine },
				},
			});
			invalidate(`user:${sid}`, sid);

			const fresh = await db.getRiotAccountByPuuid(puuid);
			return { account: fresh ? toResponse(fresh) : null };
		},
	);
}
