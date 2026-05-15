import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../api/rest.js";
import type { SaveStatus } from "../../components/SaveStatus.js";
import type { PickBanDraft } from "./types.js";

export function usePickBanDraftAutosave({
	draft,
	seriesId,
	canEdit,
}: {
	draft: PickBanDraft | null;
	seriesId: number | null;
	canEdit: boolean;
}) {
	const saveTimer = useRef<number | null>(null);
	const lastSavedDraft = useRef<string>("");
	const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
	const [savedAt, setSavedAt] = useState<number | null>(null);
	const [retryNonce, setRetryNonce] = useState(0);

	useEffect(() => {
		void retryNonce;
		if (!draft || seriesId === null || !canEdit) return;
		const serialized = JSON.stringify(draft);
		if (serialized === lastSavedDraft.current) return;
		setSaveStatus("saving");
		if (saveTimer.current) window.clearTimeout(saveTimer.current);
		saveTimer.current = window.setTimeout(() => {
			api(`/series/${seriesId}/pickban`, {
				method: "PUT",
				body: serialized,
			})
				.then(() => {
					lastSavedDraft.current = serialized;
					setSaveStatus("saved");
					setSavedAt(performance.now());
				})
				.catch((err) => {
					console.warn("[mookbot] pickban save failed", err);
					setSaveStatus("error");
				});
		}, 400);
		return () => {
			if (saveTimer.current) window.clearTimeout(saveTimer.current);
		};
	}, [draft, seriesId, canEdit, retryNonce]);

	const retrySave = useCallback(() => setRetryNonce((n) => n + 1), []);

	return { saveStatus, savedAt, retrySave, lastSavedDraft };
}
