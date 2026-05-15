import { useCallback, useMemo } from "react";
import {
	completedGameSet,
	fearlessUsedChampionIds,
	currentGameDraft as getCurrentGameDraft,
	team2Side as getTeam2Side,
	isGameTabEnabledByCompleted,
	winsByTeam,
} from "./pickBanStateLogic.js";
import type { PickBanDraft, SeriesDetail, Side } from "./types.js";

export function usePickBanDerived({
	detail,
	draft,
}: {
	detail: SeriesDetail | null;
	draft: PickBanDraft | null;
}) {
	const teamSize = detail ? detail.participants.length / 2 : 0;
	const completedGames = useMemo(() => completedGameSet(detail), [detail]);
	const noGamesPlayed = (detail?.games.length ?? 0) === 0;
	const currentGameDraft = getCurrentGameDraft(draft);
	const isCurrentGameRecorded = draft ? completedGames.has(draft.currentGame) : false;
	const seriesCompleted = detail?.series.status === "COMPLETED";
	const { t1Wins, t2Wins } = winsByTeam(detail);
	const team1Side: Side | null = currentGameDraft?.team1Side ?? null;
	const team2Side = getTeam2Side(team1Side);
	const isGameTabEnabled = useCallback(
		(n: number): boolean => isGameTabEnabledByCompleted(n, completedGames),
		[completedGames],
	);
	const fearlessUsedIds = useMemo(() => fearlessUsedChampionIds(detail, draft), [detail, draft]);

	return {
		teamSize,
		completedGames,
		noGamesPlayed,
		currentGameDraft,
		isCurrentGameRecorded,
		seriesCompleted: !!seriesCompleted,
		t1Wins,
		t2Wins,
		team1Side,
		team2Side,
		fearlessUsedIds,
		isGameTabEnabled,
	};
}
