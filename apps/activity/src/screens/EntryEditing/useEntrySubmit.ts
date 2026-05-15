import { useCallback, useState } from "react";
import { api } from "../../api/rest.js";
import { seriesAssignmentsFromDraft } from "./entryAssignment.js";
import type { Assignment } from "./types.js";

export function useEntrySubmit({
	allFilled,
	assignment,
	recruitmentId,
	coinTossDecided,
}: {
	allFilled: boolean;
	assignment: Assignment;
	recruitmentId: number | null;
	coinTossDecided: boolean;
}) {
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);

	const submit = useCallback(async (): Promise<{ seriesId: number } | null> => {
		if (!allFilled || recruitmentId === null) return null;
		setSubmitting(true);
		setSubmitError(null);
		try {
			const assignments = seriesAssignmentsFromDraft(assignment);
			return await api<{ seriesId: number }>("/series", {
				method: "POST",
				body: JSON.stringify({
					recruitmentId,
					assignments,
					...(coinTossDecided ? { team1Side: "BLUE" as const } : {}),
				}),
			});
		} catch (err) {
			setSubmitError(err instanceof Error ? err.message : String(err));
			return null;
		} finally {
			setSubmitting(false);
		}
	}, [allFilled, assignment, recruitmentId, coinTossDecided]);

	return { submitting, submitError, submit };
}
