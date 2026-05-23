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
		<div className="grid grid-cols-2 gap-2">
			<StatTile label="매물 풀" value={recruitPoolSize - captainCount} desc="팀장 제외" />
			<StatTile
				label="배치 완료"
				value={totalPlaced - captainCount}
				desc={`/ ${recruitPoolSize - captainCount}`}
				valueClassName="text-success"
			/>
			<StatTile
				label="잔여 인원"
				value={recruitPoolSize - totalPlaced}
				desc={hasCurrentBidTarget ? "1명 진행 중" : "대기"}
				valueClassName="text-info"
			/>
			<StatTile label="유찰" value={unsoldCount} desc="재경매" valueClassName="text-warning" />
		</div>
	);
}

function StatTile({
	label,
	value,
	desc,
	valueClassName,
}: {
	label: string;
	value: number;
	desc: string;
	valueClassName?: string;
}) {
	return (
		<div className="surface-soft rounded-lg border border-base-300 px-3 py-2">
			<div className="text-[11px] text-base-content/60">{label}</div>
			<div className={`text-2xl font-bold tabular-nums leading-none ${valueClassName ?? ""}`}>
				{value}
			</div>
			<div className="text-[11px] text-base-content/50 tabular-nums">{desc}</div>
		</div>
	);
}
