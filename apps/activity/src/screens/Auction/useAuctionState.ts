// 경매내전 토너먼트 상태 훅 — SWR + 모든 액션 응집.
// 일반 PickBan / EntryEditing 의 hook 패턴 따라.

import { useCallback, useEffect } from "react";
import { api } from "../../api/rest.js";
import { wsClient } from "../../api/ws.js";
import { showToast } from "../../components/Toaster.js";
import { useStaleWhileRevalidate } from "../../state/useStaleWhileRevalidate.js";
import type { AuctionTournamentDetail, MatchFormat, MatchRound } from "./types.js";
import { useAuctionActions } from "./useAuctionActions.js";

export interface UseAuctionStateResult {
	detail: AuctionTournamentDetail | null;
	error: string | null;
	refresh: () => void;
	// 액션 (운영자 전용 — 서버가 perms 검증)
	setCaptains: (userIds: string[]) => Promise<void>;
	setPoints: (points: Array<{ teamId: number; initialPoints: number }>) => Promise<void>;
	startBidding: () => Promise<void>;
	draw: () => Promise<{
		userId: string | null;
		displayName: string | null;
		remainingCount: number;
		done: boolean;
	}>;
	finalizeBid: (input: { targetUserId: string; teamId: number; points: number }) => Promise<void>;
	manualAssign: (input: { targetUserId: string; teamId: number }) => Promise<void>;
	revertBid: (targetUserId: string) => Promise<void>;
	/** v0.14: 현재 매물 취소 — 운영자가 진행 중인 매물을 닫고 다음 draw 대기 상태로. */
	cancelDraw: () => Promise<void>;
	/** v0.14: 입찰 의도 (transient) 갱신 — points=null = clear. debounced 호출 권장. */
	setBidIntent: (input: { teamId: number; points: number | null }) => Promise<void>;
	startBracket: () => Promise<void>;
	revertStage: (target: "CAPTAIN_PICK" | "POINT_ALLOC" | "BIDDING") => Promise<void>;
	createMatch: (input: {
		round: MatchRound;
		bracketIndex: number | null;
		team1Id: number;
		team2Id: number;
		format: MatchFormat;
	}) => Promise<{ matchId: number }>;
	cancel: () => Promise<void>;
}

export function useAuctionState(tournamentId: number | null): UseAuctionStateResult {
	const fetcher = useCallback(
		() => api<AuctionTournamentDetail>(`/auction-tournaments/${tournamentId}`),
		[tournamentId],
	);
	const swr = useStaleWhileRevalidate<AuctionTournamentDetail>(tournamentId, fetcher, {
		debounceMs: 150,
		enabled: tournamentId !== null,
	});

	useEffect(() => {
		if (tournamentId === null) return;
		return wsClient.subscribe(`auction-tournament:${tournamentId}`, () => {
			swr.refresh();
			showToast("다른 운영자가 경매 상태를 변경했습니다");
		});
	}, [tournamentId, swr]);
	const actions = useAuctionActions({ tournamentId, refresh: swr.refresh });

	return {
		detail: swr.data,
		error: swr.error,
		refresh: swr.refresh,
		...actions,
	};
}
