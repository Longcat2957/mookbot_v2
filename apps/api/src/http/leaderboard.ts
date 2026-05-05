// 리더보드 — 라인별 + 통합 (가중평균) MMR 랭킹.
// games_played ≥ 1 사용자만 (신규 미참여자 노이즈 차단).

import { db } from "@mookbot/core";
import type { FastifyInstance } from "fastify";
import { requireSession } from "./_helpers.js";
import { fetchPlayHistoryFor } from "./_history.js";

const ROLES = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;
type Role = (typeof ROLES)[number];

function isRole(s: string): s is Role {
	return (ROLES as readonly string[]).includes(s);
}

export async function registerLeaderboardRoutes(app: FastifyInstance): Promise<void> {
	// 라인별 — db.getLeaderboard wrap.
	app.get<{ Querystring: { role?: string; seasonId?: string; limit?: string } }>(
		"/api/leaderboard",
		async (req, reply) => {
			const sid = requireSession(req, reply);
			if (!sid) return;

			const role = req.query.role ?? "";
			if (!isRole(role)) {
				return reply.code(400).send({ error: "invalid role" });
			}
			const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)));

			let seasonId: number;
			if (req.query.seasonId) {
				seasonId = Number(req.query.seasonId);
				if (!Number.isFinite(seasonId)) return reply.code(400).send({ error: "invalid seasonId" });
			} else {
				const cur = await db.getCurrentSeason();
				if (!cur) return reply.code(404).send({ error: "no active season" });
				seasonId = cur.id;
			}

			const rows = await db.getLeaderboard(seasonId, role, limit);
			const userIds = rows.map((r) => r.user_id);
			const [users, history] = await Promise.all([
				db.listUsers(userIds),
				fetchPlayHistoryFor(userIds),
			]);
			const nameById = new Map(users.map((u) => [u.discord_id, u.display_name]));

			return {
				role,
				seasonId,
				rows: rows.map((r, i) => {
					const top = history.get(r.user_id)?.topChampions[0];
					return {
						rank: i + 1,
						userId: r.user_id,
						displayName: nameById.get(r.user_id) ?? r.user_id,
						mmr: Math.round(r.mmr),
						games: r.games_played,
						wins: r.wins,
						losses: r.games_played - r.wins,
						winrate: r.games_played > 0 ? r.wins / r.games_played : 0,
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

	// 통합 — 가중평균 MMR (Σ(mmr × games) / Σ(games)).
	app.get<{ Querystring: { seasonId?: string; limit?: string } }>(
		"/api/leaderboard/composite",
		async (req, reply) => {
			const sid = requireSession(req, reply);
			if (!sid) return;

			const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)));

			let seasonId: number;
			if (req.query.seasonId) {
				seasonId = Number(req.query.seasonId);
				if (!Number.isFinite(seasonId)) return reply.code(400).send({ error: "invalid seasonId" });
			} else {
				const cur = await db.getCurrentSeason();
				if (!cur) return reply.code(404).send({ error: "no active season" });
				seasonId = cur.id;
			}

			const rows = await db.getCompositeLeaderboard(seasonId, limit);
			const userIds = rows.map((r) => r.user_id);
			const [users, history] = await Promise.all([
				db.listUsers(userIds),
				fetchPlayHistoryFor(userIds),
			]);
			const nameById = new Map(users.map((u) => [u.discord_id, u.display_name]));

			return {
				role: "COMPOSITE" as const,
				seasonId,
				rows: rows.map((r, i) => {
					const top = history.get(r.user_id)?.topChampions[0];
					return {
						rank: i + 1,
						userId: r.user_id,
						displayName: nameById.get(r.user_id) ?? r.user_id,
						mmr: Math.round(r.weighted_mmr),
						games: r.total_games,
						wins: r.total_wins,
						losses: r.total_games - r.total_wins,
						winrate: r.total_games > 0 ? r.total_wins / r.total_games : 0,
						rolesPlayed: r.roles_played,
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
}
