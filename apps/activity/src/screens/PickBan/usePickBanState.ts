// PickBan 화면의 상태 / SWR / 저장 / WS / 단축키 / derived 계산 / 액션 묶음.
// 화면 컴포넌트 (PickBan.tsx) 는 이 hook 의 반환값을 layout 에 wiring 만 함.

import { useCallback, useState } from "react";
import { api } from "../../api/rest.js";
import type { SaveStatus } from "../../components/SaveStatus.js";
import { usePerms } from "../../state/perms.js";
import { useStaleWhileRevalidate } from "../../state/useStaleWhileRevalidate.js";
import { initialPickBanDraft } from "./pickBanStateLogic.js";
import type { Champion, GameDraft, PickBanDraft, SeriesDetail, Side } from "./types.js";
import { usePickBanActions } from "./usePickBanActions.js";
import { usePickBanCatalog } from "./usePickBanCatalog.js";
import { usePickBanDerived } from "./usePickBanDerived.js";
import { usePickBanDraftAutosave } from "./usePickBanDraftAutosave.js";
import { usePickBanGameShortcuts } from "./usePickBanGameShortcuts.js";
import { usePickBanSeriesSubscription } from "./usePickBanSeriesSubscription.js";

export interface UsePickBanStateResult {
	// data
	detail: SeriesDetail | null;
	draft: PickBanDraft | null;
	champions: Champion[];
	error: string | null;
	// save status
	saveStatus: SaveStatus;
	savedAt: number | null;
	retrySave: () => void;
	// derived (detail 이 있을 때만 의미)
	teamSize: number;
	completedGames: Set<number>;
	noGamesPlayed: boolean;
	currentGameDraft: GameDraft | null;
	isCurrentGameRecorded: boolean;
	seriesCompleted: boolean;
	t1Wins: number;
	t2Wins: number;
	team1Side: Side | null;
	team2Side: Side | null;
	fearlessUsedIds: Set<number>;
	isGameTabEnabled: (n: number) => boolean;
	// 액션
	setCurrentGame: (n: number) => void;
	setSide: (side: Side) => void;
	setGameDraft: (g: GameDraft) => void;
	refresh: () => void;
	revert: () => Promise<boolean>;
	undoLast: () => Promise<void>;
	// 액션 에러 표시
	actionError: string | null;
	clearActionError: () => void;
}

export function usePickBanState({ seriesId }: { seriesId: number | null }): UsePickBanStateResult {
	const [draft, setDraft] = useState<PickBanDraft | null>(null);
	const perms = usePerms();
	const { saveStatus, savedAt, retrySave, lastSavedDraft } = usePickBanDraftAutosave({
		draft,
		seriesId,
		canEdit: perms.canEdit,
	});

	// SWR — series detail. dirty 보호 onApply 안 (hot_fix.md §3.4).
	const detailFetcher = useCallback(() => api<SeriesDetail>(`/series/${seriesId}`), [seriesId]);
	const detailSwr = useStaleWhileRevalidate<SeriesDetail>(seriesId, detailFetcher, {
		debounceMs: 150,
		enabled: seriesId !== null,
		onApply: (next, prev) => {
			if (prev === null) {
				const initialDraft = initialPickBanDraft(next);
				setDraft(initialDraft);
				lastSavedDraft.current = JSON.stringify(initialDraft);
				return;
			}
			// 본인 dirty (lastSavedDraft 와 다름) 면 incoming pickbanDraft 무시.
			// 본인의 다음 PUT 이 last-write-wins 로 정렬됨.
			const localSerialized = draft ? JSON.stringify(draft) : "";
			const isLocalDirty = localSerialized !== lastSavedDraft.current;
			if (!isLocalDirty && next.pickbanDraft) {
				setDraft(next.pickbanDraft);
				lastSavedDraft.current = JSON.stringify(next.pickbanDraft);
			}
		},
	});
	const detail = detailSwr.data;
	const error = detailSwr.error;

	const champions = usePickBanCatalog();
	usePickBanSeriesSubscription({ seriesId, refresh: detailSwr.refresh });
	usePickBanGameShortcuts({ draft, detail, setDraft });

	const derived = usePickBanDerived({ detail, draft });
	const actions = usePickBanActions({
		seriesId,
		refresh: detailSwr.refresh,
		isGameTabEnabled: derived.isGameTabEnabled,
		setDraft,
	});

	return {
		detail,
		draft,
		champions,
		error,
		saveStatus,
		savedAt,
		retrySave,
		...derived,
		setCurrentGame: actions.setCurrentGame,
		setSide: actions.setSide,
		setGameDraft: actions.setGameDraft,
		refresh: detailSwr.refresh,
		revert: actions.revert,
		undoLast: actions.undoLast,
		actionError: actions.actionError,
		clearActionError: actions.clearActionError,
	};
}
