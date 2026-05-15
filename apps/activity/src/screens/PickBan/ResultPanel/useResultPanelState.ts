import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../api/rest.js";
import type { LineupParticipant } from "../../../components/LineupPreview.js";
import type { Champion, GameDraft, Team } from "../types.js";
import { LANE_ORDER } from "../types.js";
import { allSlotsFilled, buildPickPayload, compactChampionIds } from "./resultPanelLogic.js";

interface Params {
	seriesId: number;
	gameDraft: GameDraft;
	teamSize: number;
	participants: LineupParticipant[];
	champions: Champion[];
	canEdit: boolean;
	onRecorded: () => void;
}

export function useResultPanelState({
	seriesId,
	gameDraft,
	teamSize,
	participants: _participants,
	champions,
	canEdit,
	onRecorded,
}: Params) {
	const [winner, setWinner] = useState<Team | null>(null);
	const [durationMin, setDurationMin] = useState<string>("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const lanes = LANE_ORDER.slice(0, teamSize);
	const champById = useMemo(
		() => new Map(champions.map((champion) => [champion.id, champion])),
		[champions],
	);

	const allBansFilled =
		allSlotsFilled(gameDraft.bans.TEAM_1) && allSlotsFilled(gameDraft.bans.TEAM_2);
	const allPicksFilled =
		allSlotsFilled(gameDraft.picks.TEAM_1) && allSlotsFilled(gameDraft.picks.TEAM_2);
	const ready = allBansFilled && allPicksFilled && winner !== null && gameDraft.team1Side !== null;

	const submit = useCallback(async () => {
		if (!ready || gameDraft.team1Side === null || winner === null) return;
		setSubmitting(true);
		setError(null);
		try {
			await api(`/series/${seriesId}/games`, {
				method: "POST",
				body: JSON.stringify({
					gameNumber: gameDraft.gameNumber,
					team1Side: gameDraft.team1Side,
					winningTeam: winner,
					durationMin: durationMin ? Number(durationMin) : undefined,
					picks: {
						TEAM_1: buildPickPayload(lanes, gameDraft.picks.TEAM_1),
						TEAM_2: buildPickPayload(lanes, gameDraft.picks.TEAM_2),
					},
					bans: {
						TEAM_1: compactChampionIds(gameDraft.bans.TEAM_1),
						TEAM_2: compactChampionIds(gameDraft.bans.TEAM_2),
					},
				}),
			});
			onRecorded();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
			setSubmitting(false);
		}
	}, [ready, gameDraft, winner, durationMin, lanes, seriesId, onRecorded]);

	useEffect(() => {
		if (!canEdit) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.isComposing) return;
			const tag = (document.activeElement as HTMLElement | null)?.tagName;
			const isInInput = tag === "INPUT" || tag === "TEXTAREA";

			if (event.ctrlKey && event.key === "Enter") {
				event.preventDefault();
				if (ready && !submitting) submit();
				return;
			}

			if (isInInput) return;
			if (event.key === "1") {
				event.preventDefault();
				setWinner("TEAM_1");
			} else if (event.key === "2") {
				event.preventDefault();
				setWinner("TEAM_2");
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [canEdit, ready, submitting, submit]);

	return {
		winner,
		setWinner,
		durationMin,
		setDurationMin,
		submitting,
		error,
		lanes,
		champById,
		allBansFilled,
		allPicksFilled,
		ready,
		submit,
	};
}
