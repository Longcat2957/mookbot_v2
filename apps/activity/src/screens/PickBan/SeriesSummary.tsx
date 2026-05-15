import { PanelCard, StatusBadge } from "../../components/DesignPrimitives.js";
import { LineupPreview } from "../../components/LineupPreview.js";
import type { UsePickBanStateResult } from "./usePickBanState.js";

export function SeriesSummary({
	state,
	onSelectUser,
}: {
	state: UsePickBanStateResult;
	onSelectUser?: ((userId: string) => void) | undefined;
}) {
	if (!state.detail || !state.draft) return null;

	return (
		<PanelCard status={state.seriesCompleted ? "success" : "neutral"} bodyClassName="p-4 gap-3">
			<div className="flex items-end gap-4 flex-wrap">
				<div className="flex items-end gap-3 tabular-nums">
					<div className="text-center">
						<div className="text-[10px] uppercase tracking-wide text-info">1팀</div>
						<div className="text-3xl font-bold leading-none text-info">{state.t1Wins}</div>
					</div>
					<div className="text-2xl opacity-30 leading-none pb-1">:</div>
					<div className="text-center">
						<div className="text-[10px] uppercase tracking-wide text-error">2팀</div>
						<div className="text-3xl font-bold leading-none text-error">{state.t2Wins}</div>
					</div>
				</div>
				<div className="text-xs text-base-content/60 ml-1">
					Bo3 · {state.detail.games.length}/3 게임
					{!state.seriesCompleted && ` · Game ${state.draft.currentGame} 진행 중`}
				</div>
				{state.seriesCompleted && state.detail.series.winningTeam && (
					<div className="ml-auto flex items-center gap-2 px-3 py-1 rounded-md bg-success/10 border border-success/40">
						<span className="text-success text-base">🏆</span>
						<div>
							<div className="text-[10px] text-base-content/60 leading-none">우승</div>
							<div className="text-sm font-bold text-success">
								{state.detail.series.winningTeam === "TEAM_1" ? "1팀" : "2팀"}
							</div>
						</div>
					</div>
				)}
			</div>
			<details className="collapse collapse-arrow surface-quiet-soft">
				<summary className="collapse-title text-sm font-medium py-2 min-h-0 px-3">
					라인업 보기
					<StatusBadge tone="neutral" variant="ghost" size="xs" className="ml-2">
						{state.detail.participants.length}명
					</StatusBadge>
				</summary>
				<div className="collapse-content px-3">
					<LineupPreview
						participants={state.detail.participants}
						compact
						{...(onSelectUser ? { onSelectUser } : {})}
					/>
				</div>
			</details>
		</PanelCard>
	);
}
