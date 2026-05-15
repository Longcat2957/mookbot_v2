import type { Dispatch, SetStateAction } from "react";
import { useEffect } from "react";
import {
	completedGameSet,
	isGameTabEnabledByCompleted,
	setDraftCurrentGame,
} from "./pickBanStateLogic.js";
import type { PickBanDraft, SeriesDetail } from "./types.js";

export function usePickBanGameShortcuts({
	draft,
	detail,
	setDraft,
}: {
	draft: PickBanDraft | null;
	detail: SeriesDetail | null;
	setDraft: Dispatch<SetStateAction<PickBanDraft | null>>;
}) {
	useEffect(() => {
		if (!draft) return;
		const completedSet = completedGameSet(detail);
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== "1" && event.key !== "2" && event.key !== "3") return;
			const tag = (document.activeElement as HTMLElement | null)?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA") return;
			const gameNumber = Number(event.key);
			if (!isGameTabEnabledByCompleted(gameNumber, completedSet)) return;
			event.preventDefault();
			setDraft((prev) => setDraftCurrentGame(prev, gameNumber));
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [draft, detail, setDraft]);
}
