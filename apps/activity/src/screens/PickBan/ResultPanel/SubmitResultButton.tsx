import type { Team } from "../types.js";
import { resultSubmitTip } from "./resultPanelLogic.js";

export function SubmitResultButton({
	gameNumber,
	ready,
	submitting,
	canEdit,
	allBansFilled,
	allPicksFilled,
	team1SideSelected,
	winner,
	onSubmit,
}: {
	gameNumber: number;
	ready: boolean;
	submitting: boolean;
	canEdit: boolean;
	allBansFilled: boolean;
	allPicksFilled: boolean;
	team1SideSelected: boolean;
	winner: Team | null;
	onSubmit: () => void;
}) {
	const tip = resultSubmitTip({
		canEdit,
		allBansFilled,
		allPicksFilled,
		team1SideSelected,
		winner,
	});
	const button = (
		<button
			type="button"
			className="btn btn-success btn-block sticky bottom-2"
			onClick={onSubmit}
			disabled={!ready || submitting || !canEdit}
		>
			{submitting ? (
				<>
					<span className="loading loading-spinner loading-sm" />
					기록 중...
				</>
			) : (
				<>
					Game {gameNumber} 결과 기록
					{canEdit && (
						<span className="ml-2 inline-flex items-center gap-0.5 opacity-80">
							<kbd className="kbd kbd-sm">Ctrl</kbd>
							<span className="opacity-60">+</span>
							<kbd className="kbd kbd-sm">Enter</kbd>
						</span>
					)}
				</>
			)}
		</button>
	);

	return tip ? (
		<span className="tooltip tooltip-top w-full block" data-tip={tip}>
			{button}
		</span>
	) : (
		button
	);
}
