import type { AuctionTournamentDetail } from "../types.js";
import { BiddingTeamBidControls } from "./BiddingTeamBidControls.js";
import { BiddingTeamFillMeter } from "./BiddingTeamFillMeter.js";
import { BiddingTeamHeader } from "./BiddingTeamHeader.js";
import { BiddingTeamMemberList } from "./BiddingTeamMemberList.js";

export function BiddingTeamCard({
	team,
	isBidding,
	canEdit,
	submitting,
	sharedIntent,
	localValue,
	onBidInput,
	onFinalize,
	onManualAssign,
	onRevertBid,
}: {
	team: AuctionTournamentDetail["teams"][number];
	isBidding: boolean;
	canEdit: boolean;
	submitting: boolean;
	sharedIntent: number | undefined;
	localValue: string;
	onBidInput: (teamId: number, value: string) => void;
	onFinalize: (teamId: number) => void;
	onManualAssign: (teamId: number) => void;
	onRevertBid: (targetUserId: string) => Promise<void>;
}) {
	const pointPct =
		team.initialPoints > 0 ? Math.round((team.currentPoints / team.initialPoints) * 100) : 0;
	const fillPct = Math.round((team.members.length / 5) * 100);
	const full = team.members.length >= 5;
	const sharedDiffersFromLocal =
		sharedIntent !== undefined && localValue.trim() !== String(sharedIntent);

	return (
		<div
			className={`card surface-base shadow-sm transition ${isBidding && !full ? "ring-2 ring-primary/40" : ""}`}
		>
			<div className="card-body p-4 gap-2">
				<BiddingTeamHeader team={team} pointPct={pointPct} />
				<BiddingTeamFillMeter memberCount={team.members.length} fillPct={fillPct} />
				<BiddingTeamBidControls
					team={team}
					isBidding={isBidding}
					canEdit={canEdit}
					submitting={submitting}
					full={full}
					sharedIntent={sharedIntent}
					localValue={localValue}
					onBidInput={onBidInput}
					onFinalize={onFinalize}
					onManualAssign={onManualAssign}
				/>
				{isBidding && canEdit && sharedDiffersFromLocal && (
					<div className="text-[11px] text-base-content/60 flex items-center gap-1.5 px-1">
						<span className="inline-block size-1.5 rounded-full bg-info animate-pulse" aria-hidden />
						다른 화면 입력: <span className="font-bold tabular-nums text-info">{sharedIntent}p</span>
					</div>
				)}
				<BiddingTeamMemberList team={team} canEdit={canEdit} onRevertBid={onRevertBid} />
			</div>
		</div>
	);
}
