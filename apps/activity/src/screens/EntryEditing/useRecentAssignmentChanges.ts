import { useCallback, useEffect, useRef, useState } from "react";

export function useRecentAssignmentChanges() {
	const [recentlyChanged, setRecentlyChanged] = useState<Set<string>>(() => new Set());
	const recentClearTimer = useRef<number | null>(null);

	useEffect(
		() => () => {
			if (recentClearTimer.current) window.clearTimeout(recentClearTimer.current);
		},
		[],
	);

	const markRecentlyChanged = useCallback((changedUids: Set<string>) => {
		if (changedUids.size === 0) return;
		setRecentlyChanged(changedUids);
		if (recentClearTimer.current) window.clearTimeout(recentClearTimer.current);
		recentClearTimer.current = window.setTimeout(() => {
			setRecentlyChanged(new Set());
		}, 1500);
	}, []);

	return { recentlyChanged, markRecentlyChanged };
}
