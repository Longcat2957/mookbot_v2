import { cx, InlineNotice } from "../../../components/DesignPrimitives.js";
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
	const teamGridClass = cx(
		"grid grid-cols-1 gap-2 items-stretch",
		detail.teams.length === 2 || detail.teams.length === 4
			? "lg:grid-cols-2 auto-rows-fr"
			: "lg:grid-cols-2",
	);

	return (
		<div className="grid grid-cols-1 xl:grid-cols-[18rem_31rem_minmax(0,1fr)] gap-2 items-start xl:h-[calc(100dvh-8rem)] xl:overflow-hidden">
			<aside className="space-y-2 min-w-0 xl:h-full">
				<BiddingStats
					recruitPoolSize={s.recruitPoolSize}
					captainCount={s.captainCount}
					totalPlaced={s.totalPlaced}
					unsoldCount={detail.unsold.length}
					hasCurrentBidTarget={s.currentBidTarget !== null}
				/>
				{s.error && <InlineNotice tone="error">{s.error}</InlineNotice>}
				<UnsoldList unsold={detail.unsold} />
				<BiddingProgressFooter
					canEdit={canEdit}
					allPlaced={s.allPlaced}
					submitting={s.submitting}
					totalPlaced={s.totalPlaced}
					expectedTotal={s.expectedTotal}
					onStartBracket={onStartBracket}
				/>
			</aside>

			<aside className="min-w-0 xl:h-full">
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
			</aside>

			<div className="space-y-2 min-w-0 xl:h-full">
				<div className={`${teamGridClass} xl:h-full`}>
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
			</div>
		</div>
	);
}
