import { PanelCard, StatusBadge } from "../../../components/DesignPrimitives.js";

export function BiddingProgressFooter({
	canEdit,
	allPlaced,
	submitting,
	totalPlaced,
	expectedTotal,
	onStartBracket,
}: {
	canEdit: boolean;
	allPlaced: boolean;
	submitting: boolean;
	totalPlaced: number;
	expectedTotal: number;
	onStartBracket: () => Promise<void>;
}) {
	return (
		<PanelCard status={allPlaced ? "success" : "neutral"} bodyClassName="p-4 gap-2">
			<div className="flex items-center justify-between flex-wrap gap-2">
				<span className="text-base font-bold flex items-center gap-2">
					배치 현황
					<StatusBadge tone={allPlaced ? "success" : "neutral"} className="tabular-nums">
						{totalPlaced}/{expectedTotal}
					</StatusBadge>
				</span>
				{canEdit && (
					<button
						type="button"
						className="btn btn-success btn-lg"
						onClick={onStartBracket}
						disabled={!allPlaced || submitting}
					>
						{allPlaced ? "▶ 토너먼트 진행" : "배치 완료 후"}
					</button>
				)}
			</div>
		</PanelCard>
	);
}
