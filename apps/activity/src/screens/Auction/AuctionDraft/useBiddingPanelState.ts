import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../../api/rest.js";
import { useStaleWhileRevalidate } from "../../../state/useStaleWhileRevalidate.js";
import type { AuctionCardData } from "../CandidateInfo.js";
import type { AuctionTournamentDetail } from "../types.js";

const BID_INTENT_DEBOUNCE_MS = 300;

export function useBiddingPanelState({
	detail,
	onDraw,
	onCancelDraw,
	onSetBidIntent,
	onFinalizeBid,
	onManualAssign,
}: {
	detail: AuctionTournamentDetail;
	onDraw: () => Promise<{
		userId: string | null;
		displayName: string | null;
		remainingCount: number;
		done: boolean;
	}>;
	onCancelDraw: () => Promise<void>;
	onSetBidIntent: (input: { teamId: number; points: number | null }) => Promise<void>;
	onFinalizeBid: (input: { targetUserId: string; teamId: number; points: number }) => Promise<void>;
	onManualAssign: (input: { targetUserId: string; teamId: number }) => Promise<void>;
}) {
	const currentBidTarget = detail.tournament.currentBidTarget;
	const candidateUserId = currentBidTarget?.userId ?? null;
	const [bidPoints, setBidPoints] = useState<Record<number, string>>({});
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const lastSyncedTargetRef = useRef<string | null>(null);
	const currentTargetRef = useRef<string | null>(candidateUserId);
	useEffect(() => {
		currentTargetRef.current = candidateUserId;
	}, [candidateUserId]);
	useEffect(() => {
		const uid = currentBidTarget?.userId ?? null;
		if (uid === lastSyncedTargetRef.current) return;
		lastSyncedTargetRef.current = uid;
		if (intentTimerRef.current) {
			window.clearTimeout(intentTimerRef.current);
			intentTimerRef.current = null;
		}
		if (!currentBidTarget) {
			setBidPoints({});
			return;
		}
		const initial: Record<number, string> = {};
		for (const i of currentBidTarget.intents) initial[i.teamId] = String(i.points);
		setBidPoints(initial);
	}, [currentBidTarget]);

	const intentTimerRef = useRef<number | null>(null);
	const queueBidIntent = useCallback(
		(teamId: number, raw: string) => {
			const targetAtQueue = currentTargetRef.current;
			if (!targetAtQueue) return;
			if (intentTimerRef.current) window.clearTimeout(intentTimerRef.current);
			intentTimerRef.current = window.setTimeout(() => {
				intentTimerRef.current = null;
				if (currentTargetRef.current !== targetAtQueue) return;
				const trimmed = raw.trim();
				if (trimmed === "") {
					void onSetBidIntent({ teamId, points: null }).catch(() => undefined);
					return;
				}
				const points = Number(trimmed);
				if (!Number.isFinite(points) || points < 0) return;
				void onSetBidIntent({ teamId, points }).catch(() => undefined);
			}, BID_INTENT_DEBOUNCE_MS);
		},
		[onSetBidIntent],
	);

	useEffect(() => {
		return () => {
			if (intentTimerRef.current) window.clearTimeout(intentTimerRef.current);
		};
	}, []);

	const handleBidInput = (teamId: number, value: string) => {
		setBidPoints((prev) => ({ ...prev, [teamId]: value }));
		queueBidIntent(teamId, value);
	};

	const draw = async () => {
		setError(null);
		try {
			await onDraw();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	};

	const cancelDraw = async () => {
		setError(null);
		try {
			await onCancelDraw();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	};

	const finalize = async (teamId: number) => {
		if (!currentBidTarget) return;
		const points = Number(bidPoints[teamId] ?? 0);
		if (Number.isNaN(points) || points < 0) {
			setError("유효한 포인트 입력 필요");
			return;
		}
		setSubmitting(true);
		setError(null);
		try {
			await onFinalizeBid({ targetUserId: currentBidTarget.userId, teamId, points });
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSubmitting(false);
		}
	};

	const manualAssign = async (teamId: number) => {
		if (!currentBidTarget) return;
		setSubmitting(true);
		setError(null);
		try {
			await onManualAssign({ targetUserId: currentBidTarget.userId, teamId });
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSubmitting(false);
		}
	};

	const allPlaced = detail.teams.every((t) => t.members.length === 5);
	const totalPlaced = detail.teams.reduce((acc, t) => acc + t.members.length, 0);
	const expectedTotal = detail.teams.length * 5;
	const captainCount = detail.teams.length;
	const recruitPoolSize = expectedTotal;

	const candidateFetcher = useCallback(
		() =>
			candidateUserId
				? api<AuctionCardData>(`/users/${candidateUserId}/auction-card`)
				: Promise.reject(new Error("no candidate")),
		[candidateUserId],
	);
	const candidateSwr = useStaleWhileRevalidate<AuctionCardData>(
		candidateUserId ? `auction-card:${candidateUserId}` : null,
		candidateFetcher,
		{ enabled: candidateUserId !== null },
	);

	const intentByTeam = new Map<number, number>();
	for (const i of currentBidTarget?.intents ?? []) intentByTeam.set(i.teamId, i.points);

	return {
		allPlaced,
		bidPoints,
		cancelDraw,
		candidateData: candidateSwr.data,
		candidateError: candidateSwr.error,
		candidateRiotIcon: candidateSwr.data?.riotAccounts?.[0]?.profileIconUrl ?? null,
		captainCount,
		currentBidTarget,
		draw,
		error,
		expectedTotal,
		finalize,
		handleBidInput,
		intentByTeam,
		manualAssign,
		recruitPoolSize,
		submitting,
		totalPlaced,
	};
}
