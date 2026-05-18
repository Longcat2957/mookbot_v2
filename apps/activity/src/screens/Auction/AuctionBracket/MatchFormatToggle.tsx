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
	const [error, setError] = useState<string | null>(null);
	const toggle = async () => {
		setSubmitting(true);
		setError(null);
		try {
			await api(`/auction-matches/${matchId}/format`, {
				method: "PUT",
				body: JSON.stringify({ format: format === "BO1" ? "BO3" : "BO1" }),
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSubmitting(false);
			// 성공/실패 무관 resync — 409 (이미 기록된 게임 있음 등) 도 즉시 서버 상태 반영.
			onChanged();
		}
	};
	return (
		<>
			<button
				type="button"
				className="btn btn-sm btn-ghost"
				onClick={toggle}
				disabled={submitting}
				title={error ?? "BO1 / BO3 변경 (게임 미시작 시만)"}
			>
				↔ {format === "BO1" ? "BO3 로" : "BO1 로"}
			</button>
			{error && <span className="text-error text-xs ml-2">{error}</span>}
		</>
	);
}
