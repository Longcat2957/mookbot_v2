import { IconButton, SectionHeader, StatusBadge } from "../../../components/DesignPrimitives.js";
import { AuctionSteps } from "../AuctionSteps.js";
import type { TournamentStatus } from "../types.js";

function statusLabel(s: TournamentStatus): string {
	return {
		CAPTAIN_PICK: "팀장 선출",
		POINT_ALLOC: "포인트 배정",
		BIDDING: "경매 진행",
		PLACEMENT: "배치 완료",
		BRACKET_SETUP: "매치업 구성",
		IN_GAME: "매치 진행 중",
		COMPLETED: "종료",
		CANCELLED: "취소",
	}[s];
}

export function AuctionBracketHeader({
	tournamentId,
	format,
	status,
	onRefresh,
}: {
	tournamentId: number;
	format: 10 | 20;
	status: TournamentStatus;
	onRefresh: () => void;
}) {
	return (
		<>
			<header>
				<SectionHeader
					title={<span className="text-2xl">🎟️ 경매내전 #{tournamentId} 토너먼트</span>}
					description={
						<span>
							{format}인 · 현재 단계: <strong>{statusLabel(status)}</strong>
						</span>
					}
					actions={
						<div className="flex items-center gap-1">
							<StatusBadge tone="primary">{statusLabel(status)}</StatusBadge>
							<IconButton label="새로고침" tooltip="새로고침" onClick={onRefresh}>
								↻
							</IconButton>
						</div>
					}
				/>
			</header>
			<AuctionSteps status={status} />
		</>
	);
}
