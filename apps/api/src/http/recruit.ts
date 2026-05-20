// 모집 (recruitment) 관련 라우트 — 목록 / 상세 / 엔트리 슬롯 draft.

import { datadragon, db, riot } from "@mookbot/core";
import type { FastifyInstance } from "fastify";
import { invalidate, requireEditor, requireSession, rewriteDD } from "./_helpers.js";
import { emptyHistory, fetchPlayHistoryFor } from "./_history.js";

const { listRecruitmentParticipants, getRecruitment } = db;

type SoloRanked = {
	tier: string;
	rank: string;
	leaguePoints: number;
	wins: number;
	losses: number;
} | null;

const SOLO_RANK_CACHE_TTL_MS = 5 * 60_000;

async function fetchSoloRankedForMainAccounts(
	accounts: Awaited<ReturnType<typeof db.listMainRiotAccounts>>,
	log: { warn: (obj: unknown, msg: string) => void },
): Promise<Map<string, SoloRanked>> {
	const out = new Map<string, SoloRanked>();
	await Promise.all(
		accounts.map(async (account) => {
			const cacheKey = `recruitment-solo-rank:${account.puuid}`;
			const cached = await db.getKv(cacheKey);
			if (cached) {
				try {
					const parsed = JSON.parse(cached) as { fetchedAt: number; data: SoloRanked };
					if (parsed.fetchedAt + SOLO_RANK_CACHE_TTL_MS > Date.now()) {
						out.set(account.user_id, parsed.data);
						return;
					}
				} catch {
					// broken cache; refetch below
				}
			}
			let data: SoloRanked = null;
			try {
				const entries = await riot.getLeagueEntries(account.puuid);
				const solo = entries.find((e) => e.queueType === "RANKED_SOLO_5x5");
				if (solo) {
					data = {
						tier: solo.tier,
						rank: solo.rank,
						leaguePoints: solo.leaguePoints,
						wins: solo.wins,
						losses: solo.losses,
					};
				}
			} catch (err) {
				log.warn({ err, puuid: account.puuid }, "solo rank fetch failed");
			}
			await db.setKv(cacheKey, JSON.stringify({ fetchedAt: Date.now(), data }), "system");
			out.set(account.user_id, data);
		}),
	);
	return out;
}

export async function registerRecruitRoutes(app: FastifyInstance): Promise<void> {
	// 엔트리 수정 대기 중인 모집 목록 (status = CLOSED)
	app.get("/api/recruitments", async (req, reply) => {
		const sid = requireSession(req, reply);
		if (!sid) return;

		const rows = await db
			.listBuildableRecruitments()
			.then((rs) => rs.filter((r) => r.status === "CLOSED"));

		return {
			recruitments: rows.map((r) => ({
				id: r.id,
				targetCount: r.target_count,
				status: r.status,
				createdBy: r.created_by,
				createdAt: r.created_at,
			})),
		};
	});

	// 엔트리 슬롯 배정 draft 저장 — guild_kv 에 JSON. 다른 운영자에게 즉시 broadcast (origin 제외).
	app.put<{ Params: { id: string }; Body: unknown }>(
		"/api/recruitments/:id/entry-draft",
		async (req, reply) => {
			const sid = await requireEditor(req, reply);
			if (!sid) return;
			const id = Number(req.params.id);
			if (!Number.isFinite(id)) return reply.code(400).send({ error: "invalid id" });
			const rec = await getRecruitment(id);
			if (!rec) return reply.code(404).send({ error: "not found" });
			await db.setKv(`entry:${id}`, JSON.stringify(req.body), sid);
			invalidate(`recruitment:${id}`, sid);
			return { ok: true };
		},
	);

	// 단일 모집 상세 — 참가자 + 라인 선호 + 엔트리 draft
	app.get<{ Params: { id: string } }>("/api/recruitments/:id", async (req, reply) => {
		const sid = requireSession(req, reply);
		if (!sid) return;

		const id = Number(req.params.id);
		if (!Number.isFinite(id)) return reply.code(400).send({ error: "invalid id" });

		const rec = await getRecruitment(id);
		if (!rec) return reply.code(404).send({ error: "not found" });

		const participants = await listRecruitmentParticipants(id);
		const userIds = participants.map((p) => p.user_id);
		const [users, mains, headToHead] = await Promise.all([
			db.listUsers(userIds),
			db.listMainRiotAccounts(userIds),
			db.listHeadToHeadRecords({ userIds, seasonId: rec.season_id }),
		]);
		const nameById = new Map(users.map((u) => [u.discord_id, u.display_name]));
		const iconById = new Map(
			mains
				.filter((m) => m.profile_icon_id != null)
				.map((m) => [m.user_id, rewriteDD(datadragon.getProfileIconUrl(m.profile_icon_id as number))]),
		);
		const mainPositionById = new Map(mains.map((m) => [m.user_id, m.main_position]));

		const stats = await fetchPlayHistoryFor(userIds);
		const soloRankedById = await fetchSoloRankedForMainAccounts(mains, req.log);

		const entryDraftRaw = await db.getKv(`entry:${id}`);
		let entryDraft: unknown = null;
		if (entryDraftRaw) {
			try {
				entryDraft = JSON.parse(entryDraftRaw);
			} catch {
				entryDraft = null;
			}
		}

		return {
			recruitment: {
				id: rec.id,
				targetCount: rec.target_count,
				status: rec.status,
				createdBy: rec.created_by,
				createdAt: rec.created_at,
			},
			participants: participants.map((p) => ({
				userId: p.user_id,
				displayName: nameById.get(p.user_id) ?? p.user_id,
				roles: p.roles,
				joinedAt: p.joined_at,
				profileIconUrl: iconById.get(p.user_id) ?? null,
				soloRanked: soloRankedById.get(p.user_id) ?? null,
				mainPosition: mainPositionById.get(p.user_id) ?? null,
				history: stats.get(p.user_id) ?? emptyHistory(),
			})),
			headToHead: headToHead.map((h) => ({
				userId: h.user_id,
				opponentId: h.opponent_id,
				role: h.role,
				plays: h.plays,
				wins: h.wins,
				losses: h.plays - h.wins,
			})),
			entryDraft,
		};
	});
}
