import {
	InteractivePanelCard,
	SectionHeader,
	StatusBadge,
} from "../../components/DesignPrimitives.js";
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
			<SectionHeader
				title={<span className="text-lg">🎟️ 경매내전</span>}
				actions={<StatusBadge tone="warning">{auctionRecs.length}개 진행</StatusBadge>}
			/>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				{auctionRecs.map((auction) => (
					<InteractivePanelCard
						key={auction.id}
						status="warning"
						onClick={() => {
							if (auction.status === "CONVERTED") onSelectAuctionTournament(auction.id);
							else onSelectAuctionRecruitment(auction.id);
						}}
						bodyClassName="p-3 gap-1.5"
					>
						<div className="flex items-center justify-between">
							<span className="font-bold">🎟️ 경매내전 #{auction.id}</span>
							<StatusBadge tone="warning">{auction.targetCount}인</StatusBadge>
						</div>
						<div className="text-xs text-base-content/60">상태: {auctionStatusLabel(auction.status)}</div>
					</InteractivePanelCard>
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
