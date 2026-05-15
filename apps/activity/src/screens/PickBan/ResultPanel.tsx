import { InlineNotice, PanelCard, SectionHeader } from "../../components/DesignPrimitives.js";
import type { LineupParticipant } from "../../components/LineupPreview.js";
import { usePerms } from "../../state/perms.js";
import { DurationInput } from "./ResultPanel/DurationInput.js";
import { ResultProgressSteps } from "./ResultPanel/ResultProgressSteps.js";
import { ResultWarnings } from "./ResultPanel/ResultWarnings.js";
import { SubmitResultButton } from "./ResultPanel/SubmitResultButton.js";
import { useResultPanelState } from "./ResultPanel/useResultPanelState.js";
import { WinnerSelector } from "./ResultPanel/WinnerSelector.js";
import type { Champion, GameDraft } from "./types.js";

export function ResultPanel({
	seriesId,
	gameDraft,
	teamSize,
	participants,
	champions,
	onRecorded,
}: {
	seriesId: number;
	gameDraft: GameDraft;
	teamSize: number;
	participants: LineupParticipant[];
	champions: Champion[];
	onRecorded: () => void;
}) {
	const perms = usePerms();
	const state = useResultPanelState({
		seriesId,
		gameDraft,
		teamSize,
		participants,
		champions,
		canEdit: perms.canEdit,
		onRecorded,
	});

	return (
		<PanelCard status="success" bodyClassName="p-4 gap-3">
			<div className="space-y-2">
				<SectionHeader
					title={<span className="text-base">Game {gameDraft.gameNumber} 결과 입력</span>}
				/>
				<ResultProgressSteps
					team1SideSelected={gameDraft.team1Side !== null}
					allBansFilled={state.allBansFilled}
					allPicksFilled={state.allPicksFilled}
					winnerSelected={state.winner !== null}
				/>
			</div>

			<ResultWarnings allBansFilled={state.allBansFilled} allPicksFilled={state.allPicksFilled} />

			<WinnerSelector
				winner={state.winner}
				onSelect={state.setWinner}
				picks={gameDraft.picks}
				lanes={state.lanes}
				champById={state.champById}
				disabled={!perms.canEdit}
			/>

			<DurationInput value={state.durationMin} onChange={state.setDurationMin} />

			{state.error && <InlineNotice tone="error">{state.error}</InlineNotice>}

			<SubmitResultButton
				gameNumber={gameDraft.gameNumber}
				ready={state.ready}
				submitting={state.submitting}
				canEdit={perms.canEdit}
				allBansFilled={state.allBansFilled}
				allPicksFilled={state.allPicksFilled}
				team1SideSelected={gameDraft.team1Side !== null}
				winner={state.winner}
				onSubmit={state.submit}
			/>
		</PanelCard>
	);
}
