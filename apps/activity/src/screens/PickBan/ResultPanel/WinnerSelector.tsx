import { ResultRadioCard } from "../ResultRadioCard.js";
import type { Champion, Lane, Team } from "../types.js";

interface Props {
	winner: Team | null;
	onSelect: (team: Team) => void;
	picks: Record<Team, (number | null)[]>;
	lanes: Lane[];
	champById: Map<number, Champion>;
	disabled: boolean;
}

export function WinnerSelector({ winner, onSelect, picks, lanes, champById, disabled }: Props) {
	return (
		<div className="grid grid-cols-2 gap-3">
			<ResultRadioCard
				team="TEAM_1"
				selected={winner === "TEAM_1"}
				onClick={() => onSelect("TEAM_1")}
				pickIds={picks.TEAM_1}
				lanes={lanes}
				champById={champById}
				disabled={disabled}
			/>
			<ResultRadioCard
				team="TEAM_2"
				selected={winner === "TEAM_2"}
				onClick={() => onSelect("TEAM_2")}
				pickIds={picks.TEAM_2}
				lanes={lanes}
				champById={champById}
				disabled={disabled}
			/>
		</div>
	);
}
