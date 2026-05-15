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
			<header className="flex items-start justify-between flex-wrap gap-3">
				<div className="space-y-1">
					<h2 className="text-2xl font-bold">🎟️ 경매내전 #{tournamentId} 토너먼트</h2>
					<p className="text-base text-base-content/70">
						{format}인 · 현재 단계: <strong>{statusLabel(status)}</strong>
					</p>
				</div>
				<div className="flex items-center gap-1">
					<button type="button" className="btn btn-ghost btn-sm" onClick={onRefresh}>
						↻
					</button>
				</div>
			</header>
			<AuctionSteps status={status} />
		</>
	);
}
