import { useCallback } from "react";
import { api } from "../../api/rest.js";
import type { MatchFormat, MatchRound } from "./types.js";

export function useAuctionActions({
	tournamentId,
	refresh,
}: {
	tournamentId: number | null;
	refresh: () => void;
}) {
	const request = useCallback(
		async <T>(path: string, method: "POST" | "PUT", body?: unknown): Promise<T> => {
			const result = await api<T>(`/auction-tournaments/${tournamentId}${path}`, {
				method,
				...(body === undefined ? {} : { body: JSON.stringify(body) }),
			});
			refresh();
			return result;
		},
		[tournamentId, refresh],
	);

	return {
		setCaptains: (userIds: string[]) =>
			request<void>("/captains", "PUT", { captainUserIds: userIds }),
		setPoints: (points: Array<{ teamId: number; initialPoints: number }>) =>
			request<void>("/points", "PUT", { points }),
		startBidding: () => request<void>("/start-bidding", "POST"),
		draw: () =>
			request<{
				userId: string | null;
				displayName: string | null;
				remainingCount: number;
				done: boolean;
			}>("/draw", "POST"),
		finalizeBid: (input: { targetUserId: string; teamId: number; points: number }) =>
			request<void>("/finalize-bid", "POST", input),
		manualAssign: (input: { targetUserId: string; teamId: number }) =>
			request<void>("/manual-assign", "POST", input),
		revertBid: (targetUserId: string) => request<void>("/revert-bid", "POST", { targetUserId }),
		cancelDraw: () => request<void>("/cancel-draw", "POST"),
		setBidIntent: (input: { teamId: number; points: number | null }) =>
			request<void>("/bid-intent", "POST", input),
		startBracket: () => request<void>("/start-bracket", "POST"),
		revertStage: (target: "CAPTAIN_PICK" | "POINT_ALLOC" | "BIDDING") =>
			request<void>("/revert-stage", "POST", { target }),
		createMatch: (input: {
			round: MatchRound;
			bracketIndex: number | null;
			team1Id: number;
			team2Id: number;
			format: MatchFormat;
		}) => request<{ matchId: number }>("/matches", "POST", input),
		cancel: () => request<void>("/cancel", "POST"),
	};
}
