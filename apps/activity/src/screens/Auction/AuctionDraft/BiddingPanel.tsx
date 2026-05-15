import type { AuctionTournamentDetail } from "../types.js";
import { BiddingProgressFooter } from "./BiddingProgressFooter.js";
import { BiddingStats } from "./BiddingStats.js";
import { BiddingTeamCard } from "./BiddingTeamCard.js";
import { CurrentBidCard } from "./CurrentBidCard.js";
import { UnsoldList } from "./UnsoldList.js";
import { useBiddingPanelState } from "./useBiddingPanelState.js";

export function BiddingPanel({
	detail,
	canEdit,
	onDraw,
	onCancelDraw,
	onSetBidIntent,
	onFinalizeBid,
	onManualAssign,
	onRevertBid,
	onStartBracket,
}: {
	detail: AuctionTournamentDetail;
	canEdit: boolean;
	onDraw: () => Promise<{
		userId: string | null;
		displayName: string | null;
		remainingCount: number;
		done: boolean;
	}>;
	onCancelDraw: () => Promise<void>;
	onSetBidIntent: (input: { teamId: number; points: number | null }) => Promise<void>;
	onFinalizeBid: (input: { targetUserId: string; teamId: number; points: number }) => Promise<void>;
	onManualAssign: (input: { targetUserId: string; teamId: number }) => Promise<void>;
	onRevertBid: (targetUserId: string) => Promise<void>;
	onStartBracket: () => Promise<void>;
}) {
	const s = useBiddingPanelState({
		detail,
		onDraw,
		onCancelDraw,
		onSetBidIntent,
		onFinalizeBid,
		onManualAssign,
	});

	return (
		<div className="space-y-4">
			<BiddingStats
				recruitPoolSize={s.recruitPoolSize}
				captainCount={s.captainCount}
				totalPlaced={s.totalPlaced}
				unsoldCount={detail.unsold.length}
				hasCurrentBidTarget={s.currentBidTarget !== null}
			/>
			<CurrentBidCard
				currentBidTarget={s.currentBidTarget}
				canEdit={canEdit}
				allPlaced={s.allPlaced}
				submitting={s.submitting}
				candidateData={s.candidateData}
				candidateError={s.candidateError}
				candidateRiotIcon={s.candidateRiotIcon}
				onDraw={s.draw}
				onCancelDraw={s.cancelDraw}
			/>
			{s.error && <div className="alert alert-error">{s.error}</div>}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				{detail.teams.map((team) => (
					<BiddingTeamCard
						key={team.id}
						team={team}
						isBidding={s.currentBidTarget !== null}
						canEdit={canEdit}
						submitting={s.submitting}
						sharedIntent={s.intentByTeam.get(team.id)}
						localValue={s.bidPoints[team.id] ?? ""}
						onBidInput={s.handleBidInput}
						onFinalize={s.finalize}
						onManualAssign={s.manualAssign}
						onRevertBid={onRevertBid}
					/>
				))}
			</div>
			<UnsoldList unsold={detail.unsold} />
			<BiddingProgressFooter
				canEdit={canEdit}
				allPlaced={s.allPlaced}
				submitting={s.submitting}
				totalPlaced={s.totalPlaced}
				expectedTotal={s.expectedTotal}
				onStartBracket={onStartBracket}
			/>
		</div>
	);
}
