import { useMemo } from "react";
import type { PickBanDraft, PickUsage, SeriesDetail } from "./types.js";

export function usePreviousPicks(detail: SeriesDetail | null, draft: PickBanDraft | null) {
	return useMemo<Map<number, PickUsage[]>>(() => {
		const map = new Map<number, PickUsage[]>();
		if (!detail || !draft) return map;
		const currentGame = draft.currentGame;
		for (const game of detail.games) {
			if (game.gameNumber >= currentGame) continue;
			const team1Won = game.winningTeam === "TEAM_1";
			for (const pick of game.picks) {
				if (pick.championId == null) continue;
				const win = (pick.team === "TEAM_1") === team1Won;
				const list = map.get(pick.championId) ?? [];
				list.push({ gameNumber: game.gameNumber, team: pick.team, role: pick.role, win });
				map.set(pick.championId, list);
			}
		}
		return map;
	}, [detail, draft]);
}
