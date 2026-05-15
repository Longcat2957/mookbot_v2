import { useCallback, useEffect, useState } from "react";
import type { Slot } from "./types.js";

export function useEntrySelection({
	canEdit,
	moveTo,
}: {
	canEdit: boolean;
	moveTo: (userId: string, slot: Slot | null) => void;
}) {
	const [selectedUid, setSelectedUid] = useState<string | null>(null);

	useEffect(() => {
		if (!selectedUid) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setSelectedUid(null);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [selectedUid]);

	const clearSelected = useCallback(() => setSelectedUid(null), []);

	const handleParticipantTap = useCallback(
		(userId: string) => {
			if (!canEdit) return;
			setSelectedUid((prev) => (prev === userId ? null : userId));
		},
		[canEdit],
	);

	const handleSlotTap = useCallback(
		(slot: Slot, occupantUserId: string | null) => {
			if (!canEdit) return;
			if (selectedUid) {
				moveTo(selectedUid, slot);
				setSelectedUid(null);
			} else if (occupantUserId) {
				setSelectedUid(occupantUserId);
			}
		},
		[canEdit, selectedUid, moveTo],
	);

	const handlePoolTap = useCallback(() => {
		if (!canEdit || !selectedUid) return;
		moveTo(selectedUid, null);
		setSelectedUid(null);
	}, [canEdit, selectedUid, moveTo]);

	return {
		selectedUid,
		clearSelected,
		handleParticipantTap,
		handleSlotTap,
		handlePoolTap,
	};
}
