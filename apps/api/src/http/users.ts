// 유저 프로필 — Activity Profile 화면용.
// 라인별 MMR + 라이엇 계정 + 최근 20 게임 + 주력 챔프 (집계는 _history.ts 재사용).
// MMR 시계열 history (그래프용) 별도 endpoint.

import { datadragon, db } from "@mookbot/core";
import type { FastifyInstance } from "fastify";
import { requireSession, rewriteDD } from "./_helpers.js";
import { fetchPlayHistoryFor } from "./_history.js";

const ROLES = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;
type Role = (typeof ROLES)[number];

function isRole(s: string): s is Role {
	return (ROLES as readonly string[]).includes(s);
}

export async function registerUsersRoutes(app: FastifyInstance): Promise<void> {
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

			return {
				user: { discordId: user.discord_id, displayName: user.display_name },
				riotAccounts: riotAccounts.map((a) => ({
					gameName: a.game_name,
					tagLine: a.tag_line,
					isMain: a.puuid === mainAccount?.puuid,
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
					kills: g.kills,
					deaths: g.deaths,
					assists: g.assists,
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
}
