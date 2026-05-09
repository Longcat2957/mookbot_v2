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
	topChampions: ChampionPlay[]; // 라인 무관 — 가장 많이 플레이한 챔프 top 5 (Profile 용)
	topChampionsByRole: Record<string, ChampionPlay[]>; // 사용자가 그 라인으로 플레이했을 때의 챔프 top 5 (BalancePreview 용)
	rolePlays: RolePlay[]; // 라인별 W/L (count 기준 desc)
	topRole: RolePlay | null;
}

export function emptyHistory(): PlayHistory {
	return {
		total: { plays: 0, wins: 0, losses: 0 },
		topChampions: [],
		topChampionsByRole: {},
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

	// 챔피언별 W/L — user × role × champ 단위로 집계.
	// 라인별 슬라이스 (topChampionsByRole) + 전체 합산 (topChampions) 둘 다 1쿼리에서 도출.
	const champRows = await cloudflare.query<{
		user_id: string;
		role: string;
		champion_id: number;
		plays: number;
		wins: number;
	}>(
		`SELECT
		   gs.user_id,
		   gs.role,
		   gs.champion_id,
		   COUNT(*) AS plays,
		   SUM(CASE WHEN g.winning_team = gs.team THEN 1 ELSE 0 END) AS wins
		 FROM game_stats gs
		 JOIN games g ON g.id = gs.game_id
		 WHERE gs.user_id IN (${placeholders}) AND gs.champion_id IS NOT NULL
		 GROUP BY gs.user_id, gs.role, gs.champion_id`,
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

	// (1) 라인별 슬라이스 — user × role 별 list 누적
	// (2) overall — user × champion 합산 (라인 정보 버림)
	const byUserRole = new Map<string, Map<string, ChampionPlay[]>>(); // uid → role → list
	const byUserChamp = new Map<string, Map<number, { plays: number; wins: number }>>(); // uid → champId → 합산

	function makeChampPlay(championId: number, plays: number, wins: number): ChampionPlay {
		return {
			championId,
			championName: datadragon.getChampionName(championId),
			iconUrl: rewriteDD(datadragon.getChampionImageUrl(championId)),
			splashUrl: rewriteDD(datadragon.getChampionLoadingUrl(championId)),
			plays,
			wins,
			losses: plays - wins,
		};
	}

	for (const r of champRows) {
		// 라인별 누적
		let roleMap = byUserRole.get(r.user_id);
		if (!roleMap) {
			roleMap = new Map();
			byUserRole.set(r.user_id, roleMap);
		}
		const list = roleMap.get(r.role) ?? [];
		list.push(makeChampPlay(r.champion_id, r.plays, r.wins));
		roleMap.set(r.role, list);

		// overall 합산 (같은 챔프를 다른 라인으로도 했을 수 있음)
		let champMap = byUserChamp.get(r.user_id);
		if (!champMap) {
			champMap = new Map();
			byUserChamp.set(r.user_id, champMap);
		}
		const ex = champMap.get(r.champion_id);
		if (ex) {
			ex.plays += r.plays;
			ex.wins += r.wins;
		} else {
			champMap.set(r.champion_id, { plays: r.plays, wins: r.wins });
		}
	}

	for (const [uid, roleMap] of byUserRole) {
		const h = result.get(uid)!;
		const byRole: Record<string, ChampionPlay[]> = {};
		for (const [role, list] of roleMap) {
			list.sort((a, b) => b.plays - a.plays);
			byRole[role] = list.slice(0, 5);
		}
		h.topChampionsByRole = byRole;
	}

	for (const [uid, champMap] of byUserChamp) {
		const list: ChampionPlay[] = [];
		for (const [champId, data] of champMap) {
			list.push(makeChampPlay(champId, data.plays, data.wins));
		}
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
