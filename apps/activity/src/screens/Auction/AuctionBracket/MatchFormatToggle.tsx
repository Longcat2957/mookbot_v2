import { useState } from "react";
import { api } from "../../../api/rest.js";
import type { MatchFormat } from "../types.js";

export function MatchFormatToggle({
	matchId,
	format,
	onChanged,
}: {
	matchId: number;
	format: MatchFormat;
	onChanged: () => void;
}) {
	const [submitting, setSubmitting] = useState(false);
	const toggle = async () => {
		setSubmitting(true);
		try {
			await api(`/auction-matches/${matchId}/format`, {
				method: "PUT",
				body: JSON.stringify({ format: format === "BO1" ? "BO3" : "BO1" }),
			});
			onChanged();
		} catch {
		} finally {
			setSubmitting(false);
		}
	};
	return (
		<button
			type="button"
			className="btn btn-sm btn-ghost"
			onClick={toggle}
			disabled={submitting}
			title="BO1 / BO3 변경 (게임 미시작 시만)"
		>
			↔ {format === "BO1" ? "BO3 로" : "BO1 로"}
		</button>
	);
}
