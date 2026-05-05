// 시리즈/모집 상세에 첨부되는 참가자 전적 집계 — 챔프별 + 라인별.
// 두 라우트 (series 상세 + recruit 상세) 가 공유.

import { cloudflare, datadragon } from "@mookbot/core";
import { rewriteDD } from "./_helpers.js";

export interface WL {
	plays: number;
	wins: number;
	losses: number;
}

export interface ChampionPlay extends WL {
	championId: number;
	championName: string;
	iconUrl: string;
	splashUrl: string;
}

export interface RolePlay extends WL {
	role: string;
}

export interface PlayHistory {
	total: WL;
	topChampions: ChampionPlay[]; // 가장 많이 플레이한 챔프 top 5
	rolePlays: RolePlay[]; // 라인별 W/L (count 기준 desc)
	topRole: RolePlay | null;
}

export function emptyHistory(): PlayHistory {
	return {
		total: { plays: 0, wins: 0, losses: 0 },
		topChampions: [],
		rolePlays: [],
		topRole: null,
	};
}

/**
 * 여러 사용자의 game_stats 집계를 한 번에 — 1쿼리 챔프, 1쿼리 라인.
 * 초보 / 신규 사용자는 빈 PlayHistory.
 */
export async function fetchPlayHistoryFor(userIds: string[]): Promise<Map<string, PlayHistory>> {
	const result = new Map<string, PlayHistory>();
	if (userIds.length === 0) return result;
	for (const id of userIds) result.set(id, emptyHistory());

	const placeholders = userIds.map(() => "?").join(",");

	// 챔피언별 W/L — game_stats JOIN games
	const champRows = await cloudflare.query<{
		user_id: string;
		champion_id: number;
		plays: number;
		wins: number;
	}>(
		`SELECT
		   gs.user_id,
		   gs.champion_id,
		   COUNT(*) AS plays,
		   SUM(CASE WHEN g.winning_team = gs.team THEN 1 ELSE 0 END) AS wins
		 FROM game_stats gs
		 JOIN games g ON g.id = gs.game_id
		 WHERE gs.user_id IN (${placeholders}) AND gs.champion_id IS NOT NULL
		 GROUP BY gs.user_id, gs.champion_id`,
		userIds,
	);

	// 라인별 W/L
	const roleRows = await cloudflare.query<{
		user_id: string;
		role: string;
		plays: number;
		wins: number;
	}>(
		`SELECT
		   gs.user_id,
		   gs.role,
		   COUNT(*) AS plays,
		   SUM(CASE WHEN g.winning_team = gs.team THEN 1 ELSE 0 END) AS wins
		 FROM game_stats gs
		 JOIN games g ON g.id = gs.game_id
		 WHERE gs.user_id IN (${placeholders})
		 GROUP BY gs.user_id, gs.role`,
		userIds,
	);

	const champByUser = new Map<string, ChampionPlay[]>();
	for (const r of champRows) {
		const list = champByUser.get(r.user_id) ?? [];
		list.push({
			championId: r.champion_id,
			championName: datadragon.getChampionName(r.champion_id),
			iconUrl: rewriteDD(datadragon.getChampionImageUrl(r.champion_id)),
			splashUrl: rewriteDD(datadragon.getChampionLoadingUrl(r.champion_id)),
			plays: r.plays,
			wins: r.wins,
			losses: r.plays - r.wins,
		});
		champByUser.set(r.user_id, list);
	}
	for (const [uid, list] of champByUser) {
		list.sort((a, b) => b.plays - a.plays);
		const h = result.get(uid)!;
		h.topChampions = list.slice(0, 5);
	}

	const roleByUser = new Map<string, RolePlay[]>();
	for (const r of roleRows) {
		const list = roleByUser.get(r.user_id) ?? [];
		list.push({
			role: r.role,
			plays: r.plays,
			wins: r.wins,
			losses: r.plays - r.wins,
		});
		roleByUser.set(r.user_id, list);
	}
	for (const [uid, list] of roleByUser) {
		list.sort((a, b) => b.plays - a.plays);
		const h = result.get(uid)!;
		h.rolePlays = list;
		h.topRole = list[0] ?? null;
		const total = list.reduce(
			(acc, r) => ({
				plays: acc.plays + r.plays,
				wins: acc.wins + r.wins,
				losses: acc.losses + r.losses,
			}),
			{ plays: 0, wins: 0, losses: 0 },
		);
		h.total = total;
	}

	return result;
}
