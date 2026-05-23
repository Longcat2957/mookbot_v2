import { useCallback } from "react";
import { api } from "../../api/rest.js";
import type { MatchFormat, MatchRound } from "./types.js";

type RefreshPolicy = "always" | "error";

export function useAuctionActions({
	tournamentId,
	refresh,
}: {
	tournamentId: number | null;
	refresh: () => void;
}) {
	const request = useCallback(
		async <T>(
			path: string,
			method: "POST" | "PUT",
			body?: unknown,
			refreshPolicy: RefreshPolicy = "always",
		): Promise<T> => {
			try {
				const result = await api<T>(`/auction-tournaments/${tournamentId}${path}`, {
					method,
					...(body === undefined ? {} : { body: JSON.stringify(body) }),
				});
				if (refreshPolicy === "always") refresh();
				return result;
			} catch (err) {
				// 실패한 mutating 요청은 서버 쪽 partial change / race 여부를 클라이언트가
				// 판단할 수 없다. originUser 억제로 WS 를 못 받는 self-client 를 여기서 치유한다.
				if (refreshPolicy === "always" || refreshPolicy === "error") refresh();
				throw err;
			}
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
		// Bid intents are transient and high-frequency. The origin client already owns the
		// typed value, so only failed requests force a full tournament resync.
		setBidIntent: (input: { teamId: number; points: number | null }) =>
			request<void>("/bid-intent", "POST", input, "error"),
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
