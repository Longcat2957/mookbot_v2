import { InlineNotice, PanelCard, SectionHeader } from "../../components/DesignPrimitives.js";
import type { UseEntryEditingStateResult } from "./useEntryEditingState.js";

export function CoinTossPanel({ state }: { state: UseEntryEditingStateResult }) {
	if (!state.coinTossDecided) {
		return (
			<PanelCard status="warning" bodyClassName="p-3 gap-2">
				<SectionHeader
					title={<span className="text-sm">🪙 코인토스 — BLUE 사이드는 어느 팀?</span>}
					description="선택한 팀이 1팀으로 자동 정렬 · 미선택 시 픽/밴 화면에서 결정"
				/>
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
			</PanelCard>
		);
	}

	return (
		<InlineNotice
			tone="info"
			action={
				<button type="button" className="btn btn-xs btn-ghost" onClick={state.clearCoinToss}>
					변경
				</button>
			}
		>
			🪙 <strong>1팀 = BLUE 사이드</strong> 결정됨 · 픽/밴 사이드 결정 단계 skip
		</InlineNotice>
	);
}
