import { ConfirmButton } from "../../../components/ConfirmButton.js";
import { UserAvatar } from "../../../components/UserAvatar.js";
import type { AuctionTournamentDetail } from "../types.js";

export function BiddingTeamMemberList({
	team,
	canEdit,
	onRevertBid,
}: {
	team: AuctionTournamentDetail["teams"][number];
	canEdit: boolean;
	onRevertBid: (targetUserId: string) => Promise<void>;
}) {
	return (
		<div className="space-y-1.5">
			{team.members.length === 0 && (
				<div className="text-base text-base-content/40 text-center py-2">_(아직 없음)_</div>
			)}
			{team.members.map((m) => (
				<div key={m.userId} className="flex items-center gap-2 text-base">
					<UserAvatar
						discordId={m.userId}
						displayName={m.displayName}
						imageUrl={m.profileIconUrl}
						size="xs"
					/>
					<span className="flex-1 truncate">{m.displayName}</span>
					{m.acquiredVia === "BID" && m.acquiredAtPoints != null && (
						<span className="text-sm text-base-content/50 tabular-nums">{m.acquiredAtPoints}p</span>
					)}
					{m.acquiredVia === "MANUAL" && <span className="badge badge-xs badge-ghost">수동</span>}
					{canEdit && team.captainUserId !== m.userId && (
						<ConfirmButton
							label="✕"
							onConfirm={() => onRevertBid(m.userId)}
							variant="error"
							className="btn-xs"
						/>
					)}
				</div>
			))}
		</div>
	);
}
