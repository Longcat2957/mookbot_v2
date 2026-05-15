import { type Side, sideTextColor } from "./types.js";

export function SideSelector({
	currentGame,
	team1Side,
	team2Side,
	canEdit,
	isRecorded,
	onSetSide,
}: {
	currentGame: number;
	team1Side: Side | null;
	team2Side: Side | null;
	canEdit: boolean;
	isRecorded: boolean;
	onSetSide: (side: Side) => void;
}) {
	if (team1Side && team2Side) {
		return (
			<div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-base-200 text-sm">
				<div>
					<span className="text-xs text-base-content/60 mr-2">Game {currentGame} 사이드</span>
					<span className={sideTextColor(team1Side)}>1팀 {team1Side}</span>
					<span className="opacity-30 mx-1.5">·</span>
					<span className={sideTextColor(team2Side)}>2팀 {team2Side}</span>
				</div>
				{!isRecorded && canEdit && (
					<button
						type="button"
						className="btn btn-xs btn-ghost"
						onClick={() => onSetSide(team1Side === "BLUE" ? "RED" : "BLUE")}
					>
						사이드 변경
					</button>
				)}
			</div>
		);
	}

	return (
		<div className="card surface-base shadow-sm border-l-4 border-primary">
			<div className="card-body p-3 gap-2">
				<h3 className="font-bold text-sm">Game {currentGame} — 1팀이 어느 사이드인가요?</h3>
				<div className="grid grid-cols-2 gap-2">
					<button
						type="button"
						onClick={() => onSetSide("BLUE")}
						className="btn h-auto flex-col py-3 bg-info/10 border-info text-info hover:bg-info hover:text-info-content"
						disabled={!canEdit}
					>
						<span className="text-xs opacity-80">1팀 사이드</span>
						<span className="text-lg font-bold">BLUE</span>
						{canEdit && <kbd className="kbd kbd-xs mt-0.5">B</kbd>}
					</button>
					<button
						type="button"
						onClick={() => onSetSide("RED")}
						className="btn h-auto flex-col py-3 bg-error/10 border-error text-error hover:bg-error hover:text-error-content"
						disabled={!canEdit}
					>
						<span className="text-xs opacity-80">1팀 사이드</span>
						<span className="text-lg font-bold">RED</span>
						{canEdit && <kbd className="kbd kbd-xs mt-0.5">R</kbd>}
					</button>
				</div>
			</div>
		</div>
	);
}
