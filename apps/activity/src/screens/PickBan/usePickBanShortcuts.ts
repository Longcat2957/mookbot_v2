import { useEffect } from "react";
import type { UsePickBanStateResult } from "./usePickBanState.js";

export function usePickBanShortcuts({
	canEdit,
	state,
}: {
	canEdit: boolean;
	state: UsePickBanStateResult;
}) {
	useEffect(() => {
		if (!canEdit) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.isComposing) return;
			const tag = (document.activeElement as HTMLElement | null)?.tagName;
			const isInInput = tag === "INPUT" || tag === "TEXTAREA";

			if (event.ctrlKey && (event.key === "1" || event.key === "2" || event.key === "3")) {
				const gameNumber = Number(event.key);
				if (state.isGameTabEnabled(gameNumber)) {
					event.preventDefault();
					state.setCurrentGame(gameNumber);
				}
				return;
			}

			if (!state.draft) return;
			const currentDraft = state.draft.games.find(
				(game) => game.gameNumber === state.draft?.currentGame,
			);
			if (currentDraft?.team1Side) return;
			if (isInInput) return;
			if (event.key === "b" || event.key === "B") {
				event.preventDefault();
				state.setSide("BLUE");
			} else if (event.key === "r" || event.key === "R") {
				event.preventDefault();
				state.setSide("RED");
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [canEdit, state]);
}
