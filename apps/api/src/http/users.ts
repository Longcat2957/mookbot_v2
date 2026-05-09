// 유저 프로필 — Activity Profile 화면용.
// 라인별 MMR + 라이엇 계정 + 최근 20 게임 + 주력 챔프 (집계는 _history.ts 재사용).
// MMR 시계열 history (그래프용) 별도 endpoint.
// 선호 챔프 (게시판 텍스트 대체) GET/PUT.

import { datadragon, db } from "@mookbot/core";
import type { FastifyInstance } from "fastify";
import { invalidate, requireSession, rewriteDD } from "./_helpers.js";
import { fetchPlayHistoryFor } from "./_history.js";

const ROLES = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;
type Role = (typeof ROLES)[number];

function isRole(s: string): s is Role {
	return (ROLES as readonly string[]).includes(s);
}

const MAX_PREFERENCES_PER_ROLE = 10;

export async function registerUsersRoutes(app: FastifyInstance): Promise<void> {
	// 사용자 검색 — Discord display_name + Riot game_name 부분일치 (op.gg 스타일).
	// `:id` 라우트보다 먼저 등록 (정적 path 가 더 구체적이라 정적 match 됨).
	app.get<{ Querystring: { q?: string; limit?: string } }>(
		"/api/users/search",
		async (req, reply) => {
			const sid = requireSession(req, reply);
			if (!sid) return;

			const q = (req.query.q ?? "").trim();
			if (!q) return { query: "", users: [] };

			const limit = Math.min(20, Math.max(1, Number(req.query.limit ?? 10)));
			const hits = await db.searchUsers({ query: q, limit });
			const userIds = hits.map((h) => h.discord_id);
			const [mains, history] = await Promise.all([
				db.listMainRiotAccounts(userIds),
				fetchPlayHistoryFor(userIds),
			]);
			const mainByUser = new Map(mains.map((m) => [m.user_id, m]));

			return {
				query: q,
				users: hits.map((h) => {
					const m = mainByUser.get(h.discord_id);
					const top = history.get(h.discord_id)?.topChampions[0];
					const profileIconUrl =
						m?.profile_icon_id != null
							? rewriteDD(datadragon.getProfileIconUrl(m.profile_icon_id))
							: null;
					return {
						discordId: h.discord_id,
						displayName: h.display_name,
						profileIconUrl,
						mainAccount: m ? { gameName: m.game_name, tagLine: m.tag_line } : null,
						topChampion: top
							? {
									championId: top.championId,
									championName: top.championName,
									iconUrl: top.iconUrl,
									splashUrl: top.splashUrl,
								}
							: null,
					};
				}),
			};
		},
	);

	// 프로필 통합 — display_name + riot_accounts + lane MMRs + recent games + topChampions.
	app.get<{ Params: { id: string }; Querystring: { seasonId?: string } }>(
		"/api/users/:id/profile",
		async (req, reply) => {
			const sid = requireSession(req, reply);
			if (!sid) return;

			const userId = req.params.id;
			const user = await db.getUser(userId);
			if (!user) return reply.code(404).send({ error: "user not found" });

			let seasonId: number;
			let seasonName = "";
			if (req.query.seasonId) {
				seasonId = Number(req.query.seasonId);
				if (!Number.isFinite(seasonId)) return reply.code(400).send({ error: "invalid seasonId" });
			} else {
				const cur = await db.getCurrentSeason();
				if (!cur) return reply.code(404).send({ error: "no active season" });
				seasonId = cur.id;
				seasonName = cur.name;
			}

			const [riotAccounts, mainAccount, mmrs, recentGames, history] = await Promise.all([
				db.getRiotAccountsByUser(userId),
				db.getMainRiotAccount(userId),
				db.getLaneMmrs(
					ROLES.map((r) => ({ userId, role: r })),
					seasonId,
				),
				db.getRecentGamesForUser({ userId, seasonId, limit: 20 }),
				fetchPlayHistoryFor([userId]),
			]);

			const userHistory = history.get(userId);
			const totals = mmrs.reduce(
				(acc, m) => ({
					games: acc.games + m.games_played,
					wins: acc.wins + m.wins,
				}),
				{ games: 0, wins: 0 },
			);

			const mainProfileIconUrl =
				mainAccount?.profile_icon_id != null
					? rewriteDD(datadragon.getProfileIconUrl(mainAccount.profile_icon_id))
					: null;

			return {
				user: {
					discordId: user.discord_id,
					displayName: user.display_name,
					profileIconUrl: mainProfileIconUrl,
				},
				riotAccounts: riotAccounts.map((a) => ({
					gameName: a.game_name,
					tagLine: a.tag_line,
					isMain: a.puuid === mainAccount?.puuid,
					profileIconUrl:
						a.profile_icon_id != null ? rewriteDD(datadragon.getProfileIconUrl(a.profile_icon_id)) : null,
				})),
				season: { id: seasonId, name: seasonName },
				laneMmrs: ROLES.map((role) => {
					const m = mmrs.find((x) => x.role === role);
					if (!m || m.games_played === 0) {
						return { role, mmr: null, games: 0, wins: 0, losses: 0, winrate: 0 };
					}
					return {
						role,
						mmr: Math.round(m.mmr),
						games: m.games_played,
						wins: m.wins,
						losses: m.games_played - m.wins,
						winrate: m.wins / m.games_played,
					};
				}),
				totals: {
					games: totals.games,
					wins: totals.wins,
					losses: totals.games - totals.wins,
					winrate: totals.games > 0 ? totals.wins / totals.games : 0,
				},
				topChampions: (userHistory?.topChampions ?? []).map((c) => ({
					championId: c.championId,
					championName: c.championName,
					iconUrl: c.iconUrl,
					splashUrl: c.splashUrl,
					plays: c.plays,
					wins: c.wins,
					losses: c.losses,
					winrate: c.plays > 0 ? c.wins / c.plays : 0,
				})),
				recentGames: recentGames.map((g) => ({
					gameId: g.game_id,
					seriesId: g.series_id,
					gameNumber: g.game_number,
					playedAt: g.played_at,
					team: g.team,
					role: g.role,
					side: g.side,
					championId: g.champion_id,
					championName: g.champion_id !== null ? datadragon.getChampionName(g.champion_id) : null,
					iconUrl:
						g.champion_id !== null ? rewriteDD(datadragon.getChampionImageUrl(g.champion_id)) : null,
					won: g.won === 1,
					// K/D/A 는 Riot production key / tournament API 인증 전까지 항상 0 —
					// 페이로드에서 제외 (DB 컬럼 자체는 미래 인증 후를 위해 보존).
					cs: g.cs,
					mmrDelta: g.mmr_delta !== null ? Math.round(g.mmr_delta) : null,
					mmrAfter: g.mmr_after !== null ? Math.round(g.mmr_after) : null,
				})),
			};
		},
	);

	// MMR 시계열 — 그래프용. role 별 / 시즌 필터.
	app.get<{
		Params: { id: string };
		Querystring: { role?: string; seasonId?: string; limit?: string };
	}>("/api/users/:id/mmr-history", async (req, reply) => {
		const sid = requireSession(req, reply);
		if (!sid) return;

		const userId = req.params.id;
		const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 200)));

		let role: Role | undefined;
		if (req.query.role) {
			if (!isRole(req.query.role)) return reply.code(400).send({ error: "invalid role" });
			role = req.query.role;
		}

		let seasonId: number | undefined;
		if (req.query.seasonId) {
			seasonId = Number(req.query.seasonId);
			if (!Number.isFinite(seasonId)) return reply.code(400).send({ error: "invalid seasonId" });
		} else {
			const cur = await db.getCurrentSeason();
			if (cur) seasonId = cur.id;
		}

		const rows = await db.getMmrHistoryForUser({
			userId,
			...(seasonId !== undefined ? { seasonId } : {}),
			...(role !== undefined ? { role } : {}),
			limit,
		});

		return {
			userId,
			role: role ?? null,
			seasonId: seasonId ?? null,
			points: rows.map((r) => ({
				createdAt: r.created_at,
				gameId: r.game_id,
				role: r.role,
				mmrBefore: Math.round(r.mmr_before),
				mmrAfter: Math.round(r.mmr_after),
				delta: Math.round(r.delta),
			})),
		};
	});

	// 선호 챔프 조회 — 누구나 볼 수 있음 (게시판 텍스트 대체 목적).
	app.get<{ Params: { id: string } }>("/api/users/:id/preferences", async (req, reply) => {
		const sid = requireSession(req, reply);
		if (!sid) return;

		const userId = req.params.id;
		const user = await db.getUser(userId);
		if (!user) return reply.code(404).send({ error: "user not found" });

		const rows = await db.getUserChampionPreferences(userId);
		const byRole: Record<Role, { championId: number; championName: string; iconUrl: string }[]> = {
			TOP: [],
			JUNGLE: [],
			MID: [],
			BOTTOM: [],
			SUPPORT: [],
		};
		for (const r of rows) {
			byRole[r.role].push({
				championId: r.champion_id,
				championName: datadragon.getChampionName(r.champion_id),
				iconUrl: rewriteDD(datadragon.getChampionImageUrl(r.champion_id)),
			});
		}

		return {
			user: { discordId: user.discord_id, displayName: user.display_name },
			maxPerRole: MAX_PREFERENCES_PER_ROLE,
			preferences: byRole,
		};
	});

	// 선호 챔프 한 라인 갱신 — 본인만. championIds 의 배열 순서 = 표시 순서.
	app.put<{ Body: unknown }>("/api/users/me/preferences", async (req, reply) => {
		const sid = requireSession(req, reply);
		if (!sid) return;

		const body = req.body as { role?: unknown; championIds?: unknown } | null;
		if (!body || typeof body !== "object") {
			return reply.code(400).send({ error: "invalid body" });
		}
		const { role, championIds } = body;
		if (typeof role !== "string" || !isRole(role)) {
			return reply.code(400).send({ error: "invalid role" });
		}
		if (!Array.isArray(championIds)) {
			return reply.code(400).send({ error: "championIds must be array" });
		}
		if (championIds.length > MAX_PREFERENCES_PER_ROLE) {
			return reply
				.code(400)
				.send({ error: `라인당 최대 ${MAX_PREFERENCES_PER_ROLE}개까지 등록할 수 있습니다.` });
		}
		const validIds: number[] = [];
		for (const raw of championIds) {
			if (typeof raw !== "number" || !Number.isInteger(raw) || raw <= 0) {
				return reply.code(400).send({ error: "championIds must be positive integers" });
			}
			validIds.push(raw);
		}

		// FK (user_id → users.discord_id) 보장. 신규 사용자는 봇 슬래시 한 번 이상 거쳐야 함.
		const me = await db.getUser(sid);
		if (!me) {
			return reply.code(404).send({
				error: "사용자 등록이 먼저 필요합니다 — 봇 채널에서 /등록 또는 모집 참여 후 다시 시도해주세요.",
			});
		}
		await db.setUserLaneChampionPreferences({ userId: sid, role, championIds: validIds });

		invalidate(`user:${sid}`, sid);
		return { ok: true };
	});
}
