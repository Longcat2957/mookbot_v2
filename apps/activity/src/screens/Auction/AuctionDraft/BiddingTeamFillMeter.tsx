export function BiddingTeamFillMeter({
	memberCount,
	fillPct,
}: {
	memberCount: number;
	fillPct: number;
}) {
	return (
		<div className="space-y-1">
			<div className="flex items-center justify-between text-sm">
				<span className="font-medium">팀원</span>
				<span className="text-base-content/60 tabular-nums">{memberCount}/5</span>
			</div>
			<progress
				className={`progress ${memberCount === 5 ? "progress-success" : "progress-info"} w-full`}
				value={fillPct}
				max={100}
			/>
		</div>
	);
}
