import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../api/rest.js";
import type { SaveStatus } from "../../components/SaveStatus.js";
import { serializeAssignment } from "./entryAssignment.js";
import type { Assignment, RecruitmentDetail } from "./types.js";

interface Params {
	recruitmentId: number | null;
	canEdit: boolean;
	detail: RecruitmentDetail | null;
	assignment: Assignment;
}

export function useEntryDraftAutosave({ recruitmentId, canEdit, detail, assignment }: Params) {
	const draftSaveTimer = useRef<number | null>(null);
	const lastSaved = useRef<string>("{}");
	const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
	const [savedAt, setSavedAt] = useState<number | null>(null);
	const [retryNonce, setRetryNonce] = useState(0);

	useEffect(() => {
		void retryNonce;
		if (recruitmentId === null || !canEdit || !detail) return;
		const serialized = serializeAssignment(assignment);
		if (serialized === lastSaved.current) return;
		setSaveStatus("saving");
		if (draftSaveTimer.current) window.clearTimeout(draftSaveTimer.current);
		draftSaveTimer.current = window.setTimeout(() => {
			api(`/recruitments/${recruitmentId}/entry-draft`, {
				method: "PUT",
				body: JSON.stringify({ assignments: Object.fromEntries(assignment) }),
			})
				.then(() => {
					lastSaved.current = serialized;
					setSaveStatus("saved");
					setSavedAt(performance.now());
				})
				.catch((err) => {
					console.warn("[mookbot] entry-draft save failed", err);
					setSaveStatus("error");
				});
		}, 250);
		return () => {
			if (draftSaveTimer.current) window.clearTimeout(draftSaveTimer.current);
		};
	}, [assignment, recruitmentId, canEdit, retryNonce, detail]);

	const retrySave = useCallback(() => setRetryNonce((n) => n + 1), []);

	return { saveStatus, savedAt, retrySave, lastSaved };
}
