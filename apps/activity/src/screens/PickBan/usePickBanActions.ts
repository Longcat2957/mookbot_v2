import { type Dispatch, type SetStateAction, useCallback, useState } from "react";
import { api } from "../../api/rest.js";
import {
	replaceCurrentGameDraft,
	setDraftCurrentGame,
	setDraftTeam1Side,
} from "./pickBanStateLogic.js";
import type { GameDraft, PickBanDraft, Side } from "./types.js";

export function usePickBanActions({
	seriesId,
	refresh,
	isGameTabEnabled,
	setDraft,
}: {
	seriesId: number | null;
	refresh: () => void;
	isGameTabEnabled: (n: number) => boolean;
	setDraft: Dispatch<SetStateAction<PickBanDraft | null>>;
}) {
	const [actionError, setActionError] = useState<string | null>(null);

	const setCurrentGame = useCallback(
		(n: number) => {
			if (!isGameTabEnabled(n)) return;
			setDraft((prev) => setDraftCurrentGame(prev, n));
		},
		[isGameTabEnabled, setDraft],
	);

	const setSide = useCallback(
		(side: Side) => {
			setDraft((prev) => setDraftTeam1Side(prev, side));
		},
		[setDraft],
	);

	const setGameDraft = useCallback(
		(g: GameDraft) => {
			setDraft((prev) => replaceCurrentGameDraft(prev, g));
		},
		[setDraft],
	);

	const revert = useCallback(async (): Promise<boolean> => {
		setActionError(null);
		try {
			await api(`/series/${seriesId}/revert`, { method: "POST" });
			return true;
		} catch (err) {
			setActionError(`되돌리기 실패: ${err instanceof Error ? err.message : String(err)}`);
			return false;
		}
	}, [seriesId]);

	const undoLast = useCallback(async () => {
		setActionError(null);
		try {
			await api(`/series/${seriesId}/games/last`, { method: "DELETE" });
			refresh();
		} catch (err) {
			setActionError(`되돌리기 실패: ${err instanceof Error ? err.message : String(err)}`);
		}
	}, [seriesId, refresh]);

	const clearActionError = useCallback(() => setActionError(null), []);

	return {
		setCurrentGame,
		setSide,
		setGameDraft,
		revert,
		undoLast,
		actionError,
		clearActionError,
	};
}
