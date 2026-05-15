import type { UseEntryEditingStateResult } from "./useEntryEditingState.js";

export function CoinTossPanel({ state }: { state: UseEntryEditingStateResult }) {
	if (!state.coinTossDecided) {
		return (
			<div className="card surface-base shadow-sm border-l-4 border-warning">
				<div className="card-body p-3 gap-2">
					<div className="flex items-baseline justify-between flex-wrap gap-2">
						<h3 className="font-bold text-sm">🪙 코인토스 — BLUE 사이드는 어느 팀?</h3>
						<span className="text-xs text-base-content/60">
							선택한 팀이 1팀으로 자동 정렬 · 미선택 시 픽/밴 화면에서 결정
						</span>
					</div>
					<div className="grid grid-cols-2 gap-2">
						<button
							type="button"
							onClick={() => state.setCoinTossWinner("TEAM_1")}
							className="btn h-auto py-2.5 bg-info/10 border-info text-info hover:bg-info hover:text-info-content"
							disabled={state.submitting}
						>
							1팀이 BLUE
							<span className="text-xs opacity-70 ml-1">(그대로)</span>
						</button>
						<button
							type="button"
							onClick={() => state.setCoinTossWinner("TEAM_2")}
							className="btn h-auto py-2.5 bg-info/10 border-info text-info hover:bg-info hover:text-info-content"
							disabled={state.submitting}
						>
							2팀이 BLUE
							<span className="text-xs opacity-70 ml-1">(좌/우 swap)</span>
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="alert alert-info alert-soft py-2 flex-row items-center gap-2">
			<span className="text-sm flex-1">
				🪙 <strong>1팀 = BLUE 사이드</strong> 결정됨 · 픽/밴 사이드 결정 단계 skip
			</span>
			<button type="button" className="btn btn-xs btn-ghost" onClick={state.clearCoinToss}>
				변경
			</button>
		</div>
	);
}
