import type { AuctionRecListItem } from "../../features/dashboard/types.js";

export function AuctionSection({
	isLoading,
	auctionRecs,
	onSelectAuctionRecruitment,
	onSelectAuctionTournament,
}: {
	isLoading: boolean;
	auctionRecs: AuctionRecListItem[];
	onSelectAuctionRecruitment: (id: number) => void;
	onSelectAuctionTournament: (id: number) => void;
}) {
	if (isLoading || auctionRecs.length === 0) return null;

	return (
		<div className="space-y-2">
			<div className="flex items-baseline gap-2">
				<h2 className="text-lg font-bold">🎟️ 경매내전</h2>
				<span className="text-xs text-base-content/60">{auctionRecs.length}개 진행</span>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				{auctionRecs.map((auction) => (
					<button
						key={auction.id}
						type="button"
						onClick={() => {
							if (auction.status === "CONVERTED") onSelectAuctionTournament(auction.id);
							else onSelectAuctionRecruitment(auction.id);
						}}
						className="card-action card-status-waiting"
					>
						<div className="card-body p-3 gap-1.5">
							<div className="flex items-center justify-between">
								<span className="font-bold">🎟️ 경매내전 #{auction.id}</span>
								<span className="badge badge-warning badge-sm">{auction.targetCount}인</span>
							</div>
							<div className="text-xs text-base-content/60">
								상태: {auctionStatusLabel(auction.status)}
							</div>
						</div>
					</button>
				))}
			</div>
		</div>
	);
}

function auctionStatusLabel(status: string) {
	if (status === "OPEN") return "🟦 모집 중";
	if (status === "CLOSED") return "🟡 경매 진행 중";
	if (status === "CONVERTED") return "🟣 토너먼트 진행 중";
	return status;
}
