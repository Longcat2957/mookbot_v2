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
	canEdit,
}: {
	seriesId: number | null;
	refresh: () => void;
	isGameTabEnabled: (n: number) => boolean;
	setDraft: Dispatch<SetStateAction<PickBanDraft | null>>;
	canEdit: boolean;
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
			if (!canEdit) return;
			setDraft((prev) => setDraftTeam1Side(prev, side));
		},
		[canEdit, setDraft],
	);

	const setGameDraft = useCallback(
		(g: GameDraft) => {
			if (!canEdit) return;
			setDraft((prev) => replaceCurrentGameDraft(prev, g));
		},
		[canEdit, setDraft],
	);

	const revert = useCallback(async (): Promise<boolean> => {
		if (!canEdit) return false;
		setActionError(null);
		try {
			await api(`/series/${seriesId}/revert`, { method: "POST" });
			return true;
		} catch (err) {
			setActionError(`되돌리기 실패: ${err instanceof Error ? err.message : String(err)}`);
			return false;
		}
	}, [seriesId, canEdit]);

	const undoLast = useCallback(async () => {
		if (!canEdit) return;
		setActionError(null);
		try {
			await api(`/series/${seriesId}/games/last`, { method: "DELETE" });
			refresh();
		} catch (err) {
			setActionError(`되돌리기 실패: ${err instanceof Error ? err.message : String(err)}`);
		}
	}, [seriesId, refresh, canEdit]);

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
