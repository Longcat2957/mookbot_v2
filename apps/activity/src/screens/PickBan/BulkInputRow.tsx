import { kindLabel, teamLabel } from "./bulkInputLogic.js";
import type { Team } from "./types.js";

export function BulkInputRow({
	team,
	kind,
	value,
	onChange,
	onApply,
	placeholder,
}: {
	team: Team;
	kind: "ban" | "pick";
	value: string;
	onChange: (v: string) => void;
	onApply: (team: Team, kind: "ban" | "pick", input: string) => void;
	placeholder: string;
}) {
	const label = `${teamLabel(team)} ${kindLabel(kind)}`;
	const accent = team === "TEAM_1" ? "border-info" : "border-error";

	return (
		<div className={`flex items-center gap-1.5 border-l-2 pl-2 ${accent}`}>
			<span className="text-xs font-semibold w-12 shrink-0 tabular-nums">{label}</span>
			<input
				type="text"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						onApply(team, kind, value);
					}
				}}
				placeholder={placeholder}
				className="input input-sm input-bordered flex-1 min-w-0"
				aria-label={`${label} 일괄 입력`}
			/>
			<button
				type="button"
				className="btn btn-sm btn-ghost"
				onClick={() => onApply(team, kind, value)}
				disabled={value.trim() === ""}
			>
				적용
			</button>
		</div>
	);
}
