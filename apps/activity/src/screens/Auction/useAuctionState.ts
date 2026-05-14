// 경매내전 토너먼트 상태 훅 — SWR + 모든 액션 응집.
// 일반 PickBan / EntryEditing 의 hook 패턴 따라.

import { useCallback, useEffect } from "react";
import { api } from "../../api/rest.js";
import { wsClient } from "../../api/ws.js";
import { showToast } from "../../components/Toaster.js";
import { useStaleWhileRevalidate } from "../../state/useStaleWhileRevalidate.js";
import type { AuctionTournamentDetail, MatchFormat, MatchRound } from "./types.js";

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

	const setCaptains = useCallback(
		async (userIds: string[]) => {
			await api(`/auction-tournaments/${tournamentId}/captains`, {
				method: "PUT",
				body: JSON.stringify({ captainUserIds: userIds }),
			});
			swr.refresh();
		},
		[tournamentId, swr],
	);

	const setPoints = useCallback(
		async (points: Array<{ teamId: number; initialPoints: number }>) => {
			await api(`/auction-tournaments/${tournamentId}/points`, {
				method: "PUT",
				body: JSON.stringify({ points }),
			});
			swr.refresh();
		},
		[tournamentId, swr],
	);

	const startBidding = useCallback(async () => {
		await api(`/auction-tournaments/${tournamentId}/start-bidding`, { method: "POST" });
		swr.refresh();
	}, [tournamentId, swr]);

	const draw = useCallback(async () => {
		return api<{
			userId: string | null;
			displayName: string | null;
			remainingCount: number;
			done: boolean;
		}>(`/auction-tournaments/${tournamentId}/draw`, { method: "POST" });
	}, [tournamentId]);

	const finalizeBid = useCallback(
		async (input: { targetUserId: string; teamId: number; points: number }) => {
			await api(`/auction-tournaments/${tournamentId}/finalize-bid`, {
				method: "POST",
				body: JSON.stringify(input),
			});
			swr.refresh();
		},
		[tournamentId, swr],
	);

	const manualAssign = useCallback(
		async (input: { targetUserId: string; teamId: number }) => {
			await api(`/auction-tournaments/${tournamentId}/manual-assign`, {
				method: "POST",
				body: JSON.stringify(input),
			});
			swr.refresh();
		},
		[tournamentId, swr],
	);

	const revertBid = useCallback(
		async (targetUserId: string) => {
			await api(`/auction-tournaments/${tournamentId}/revert-bid`, {
				method: "POST",
				body: JSON.stringify({ targetUserId }),
			});
			swr.refresh();
		},
		[tournamentId, swr],
	);

	const cancelDraw = useCallback(async () => {
		await api(`/auction-tournaments/${tournamentId}/cancel-draw`, { method: "POST" });
		swr.refresh();
	}, [tournamentId, swr]);

	const setBidIntent = useCallback(
		async (input: { teamId: number; points: number | null }) => {
			await api(`/auction-tournaments/${tournamentId}/bid-intent`, {
				method: "POST",
				body: JSON.stringify(input),
			});
			// 본인은 WS origin-suppress 되어 broadcast 못 받음 — refresh 로 직접 sync.
			// useStaleWhileRevalidate 의 debounce(150ms) 가 연쇄 호출 흡수.
			swr.refresh();
		},
		[tournamentId, swr],
	);

	const startBracket = useCallback(async () => {
		await api(`/auction-tournaments/${tournamentId}/start-bracket`, { method: "POST" });
		swr.refresh();
	}, [tournamentId, swr]);

	const revertStage = useCallback(
		async (target: "CAPTAIN_PICK" | "POINT_ALLOC" | "BIDDING") => {
			await api(`/auction-tournaments/${tournamentId}/revert-stage`, {
				method: "POST",
				body: JSON.stringify({ target }),
			});
			swr.refresh();
		},
		[tournamentId, swr],
	);

	const createMatch = useCallback(
		async (input: {
			round: MatchRound;
			bracketIndex: number | null;
			team1Id: number;
			team2Id: number;
			format: MatchFormat;
		}) => {
			const res = await api<{ matchId: number }>(`/auction-tournaments/${tournamentId}/matches`, {
				method: "POST",
				body: JSON.stringify(input),
			});
			swr.refresh();
			return res;
		},
		[tournamentId, swr],
	);

	const cancel = useCallback(async () => {
		await api(`/auction-tournaments/${tournamentId}/cancel`, { method: "POST" });
		swr.refresh();
	}, [tournamentId, swr]);

	return {
		detail: swr.data,
		error: swr.error,
		refresh: swr.refresh,
		setCaptains,
		setPoints,
		startBidding,
		draw,
		finalizeBid,
		manualAssign,
		revertBid,
		cancelDraw,
		setBidIntent,
		startBracket,
		revertStage,
		createMatch,
		cancel,
	};
}
