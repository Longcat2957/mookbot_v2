export function BiddingStats({
	recruitPoolSize,
	captainCount,
	totalPlaced,
	unsoldCount,
	hasCurrentBidTarget,
}: {
	recruitPoolSize: number;
	captainCount: number;
	totalPlaced: number;
	unsoldCount: number;
	hasCurrentBidTarget: boolean;
}) {
	return (
		<div className="stats stats-horizontal shadow w-full bg-base-200">
			<div className="stat py-3">
				<div className="stat-title text-sm">매물 풀</div>
				<div className="stat-value text-3xl tabular-nums">{recruitPoolSize - captainCount}</div>
				<div className="stat-desc text-sm">팀장 제외</div>
			</div>
			<div className="stat py-3">
				<div className="stat-title text-sm">배치 완료</div>
				<div className="stat-value text-3xl text-success tabular-nums">
					{totalPlaced - captainCount}
				</div>
				<div className="stat-desc text-sm tabular-nums">/ {recruitPoolSize - captainCount}</div>
			</div>
			<div className="stat py-3">
				<div className="stat-title text-sm">잔여 인원</div>
				<div className="stat-value text-3xl text-info tabular-nums">
					{recruitPoolSize - totalPlaced}
				</div>
				<div className="stat-desc text-sm">{hasCurrentBidTarget ? "1명 진행 중" : "—"}</div>
			</div>
			<div className="stat py-3">
				<div className="stat-title text-sm">유찰</div>
				<div className="stat-value text-3xl text-warning tabular-nums">{unsoldCount}</div>
				<div className="stat-desc text-sm">재경매 대기</div>
			</div>
		</div>
	);
}
