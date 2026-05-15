import type { GameTeam } from "./gameInputTypes.js";

export function GameSideControls({
	team1Side,
	winningTeam,
	team1Index,
	team2Index,
	onTeam1SideChange,
	onWinningTeamChange,
}: {
	team1Side: "BLUE" | "RED";
	winningTeam: GameTeam;
	team1Index: number;
	team2Index: number;
	onTeam1SideChange: (side: "BLUE" | "RED") => void;
	onWinningTeamChange: (team: GameTeam) => void;
}) {
	return (
		<>
			<div className="flex items-center gap-3 text-xs">
				<span>1팀 사이드:</span>
				<div className="join">
					<button
						type="button"
						className={`btn btn-xs join-item ${team1Side === "BLUE" ? "btn-info" : "btn-ghost"}`}
						onClick={() => onTeam1SideChange("BLUE")}
					>
						BLUE
					</button>
					<button
						type="button"
						className={`btn btn-xs join-item ${team1Side === "RED" ? "btn-error" : "btn-ghost"}`}
						onClick={() => onTeam1SideChange("RED")}
					>
						RED
					</button>
				</div>
			</div>
			<div className="flex items-center gap-3 text-xs">
				<span>승팀:</span>
				<div className="join">
					<button
						type="button"
						className={`btn btn-xs join-item ${winningTeam === "TEAM_1" ? "btn-info" : "btn-ghost"}`}
						onClick={() => onWinningTeamChange("TEAM_1")}
					>
						팀{team1Index} 승
					</button>
					<button
						type="button"
						className={`btn btn-xs join-item ${winningTeam === "TEAM_2" ? "btn-error" : "btn-ghost"}`}
						onClick={() => onWinningTeamChange("TEAM_2")}
					>
						팀{team2Index} 승
					</button>
				</div>
			</div>
		</>
	);
}
