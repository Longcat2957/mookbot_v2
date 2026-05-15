import { useCallback, useEffect } from "react";
import { api } from "../../api/rest.js";
import { wsClient } from "../../api/ws.js";
import { showToast } from "../../components/Toaster.js";
import { useStaleWhileRevalidate } from "../../state/useStaleWhileRevalidate.js";
import type { LeaderboardResponse, LeaderboardTab } from "./types.js";

export function useLeaderboardData(tab: LeaderboardTab) {
	const fetcher = useCallback(() => {
		const url =
			tab === "COMPOSITE" ? "/leaderboard/composite?limit=50" : `/leaderboard?role=${tab}&limit=50`;
		return api<LeaderboardResponse>(url);
	}, [tab]);

	const swr = useStaleWhileRevalidate<LeaderboardResponse>(`leaderboard:${tab}`, fetcher, {
		debounceMs: 150,
	});

	useEffect(() => {
		return wsClient.subscribe(`leaderboard:${tab}`, () => {
			swr.refresh();
			showToast("리더보드가 업데이트되었습니다");
		});
	}, [tab, swr]);

	return swr;
}
