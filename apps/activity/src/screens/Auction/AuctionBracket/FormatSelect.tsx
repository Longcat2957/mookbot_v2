import type { MatchFormat } from "../types.js";

export function FormatSelect({
	value,
	onChange,
}: {
	value: MatchFormat;
	onChange: (v: MatchFormat) => void;
}) {
	return (
		<div className="join">
			<button
				type="button"
				className={`btn join-item ${value === "BO1" ? "btn-primary" : "btn-ghost"}`}
				onClick={() => onChange("BO1")}
			>
				BO1
			</button>
			<button
				type="button"
				className={`btn join-item ${value === "BO3" ? "btn-primary" : "btn-ghost"}`}
				onClick={() => onChange("BO3")}
			>
				BO3
			</button>
		</div>
	);
}
