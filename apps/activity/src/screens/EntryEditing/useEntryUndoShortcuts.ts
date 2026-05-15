import { useEffect } from "react";

export function useEntryUndoShortcuts({
	canEdit,
	undo,
	redo,
}: {
	canEdit: boolean;
	undo: () => void;
	redo: () => void;
}) {
	useEffect(() => {
		if (!canEdit) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.isComposing || !e.ctrlKey) return;
			if ((e.key === "z" || e.key === "Z") && !e.shiftKey) {
				e.preventDefault();
				undo();
			} else if ((e.key === "z" || e.key === "Z") && e.shiftKey) {
				e.preventDefault();
				redo();
			} else if (e.key === "y" || e.key === "Y") {
				e.preventDefault();
				redo();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [canEdit, undo, redo]);
}
