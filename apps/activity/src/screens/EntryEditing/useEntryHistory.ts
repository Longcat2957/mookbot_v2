import { useCallback, useState } from "react";
import type { Assignment } from "./types.js";

const HISTORY_MAX = 20;

export function useEntryHistory({
	setAssignment,
	clearSelected,
}: {
	setAssignment: (assignment: Assignment) => void;
	clearSelected: () => void;
}) {
	const [history, setHistory] = useState<Assignment[]>([new Map()]);
	const [historyIdx, setHistoryIdx] = useState(0);

	const pushHistory = useCallback(
		(snapshot: Assignment) => {
			setHistory((prev) => {
				const truncated = prev.slice(0, Math.max(1, historyIdx + 1));
				const next = [...truncated, new Map(snapshot)];
				return next.length > HISTORY_MAX ? next.slice(-HISTORY_MAX) : next;
			});
			setHistoryIdx((prev) => Math.min(prev + 1, HISTORY_MAX - 1));
		},
		[historyIdx],
	);

	const undo = useCallback(() => {
		if (historyIdx <= 0) return;
		const newIdx = historyIdx - 1;
		const snap = history[newIdx];
		if (!snap) return;
		setHistoryIdx(newIdx);
		setAssignment(new Map(snap));
		clearSelected();
	}, [history, historyIdx, setAssignment, clearSelected]);

	const redo = useCallback(() => {
		if (historyIdx >= history.length - 1) return;
		const newIdx = historyIdx + 1;
		const snap = history[newIdx];
		if (!snap) return;
		setHistoryIdx(newIdx);
		setAssignment(new Map(snap));
		clearSelected();
	}, [history, historyIdx, setAssignment, clearSelected]);

	return {
		pushHistory,
		undo,
		redo,
		canUndo: historyIdx > 0,
		canRedo: historyIdx < history.length - 1,
	};
}
