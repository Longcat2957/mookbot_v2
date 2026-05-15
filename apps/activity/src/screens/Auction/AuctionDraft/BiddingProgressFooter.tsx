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
		<div className="card surface-base shadow">
			<div className="card-body p-4 gap-2">
				<div className="flex items-center justify-between flex-wrap gap-2">
					<span className="text-base font-bold">
						배치 현황{" "}
						<span className="tabular-nums text-lg">
							{totalPlaced}/{expectedTotal}
						</span>
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
			</div>
		</div>
	);
}
