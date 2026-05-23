import type { CSSProperties } from "react";
import { UserAvatar } from "../../../components/UserAvatar.js";
import type { AuctionTournamentDetail } from "../types.js";

export function BiddingTeamHeader({
	team,
	pointPct,
}: {
	team: AuctionTournamentDetail["teams"][number];
	pointPct: number;
}) {
	return (
		<div className="flex items-center gap-2">
			<div
				className="radial-progress text-warning tabular-nums"
				style={
					{
						"--value": pointPct,
						"--size": "2.85rem",
						"--thickness": "4px",
					} as CSSProperties
				}
				aria-valuenow={pointPct}
				role="progressbar"
				aria-label={`팀${team.teamIndex} 잔여 포인트 ${team.currentPoints} / ${team.initialPoints}`}
			>
				<span className="text-[11px] font-bold">{team.currentPoints}p</span>
			</div>
			<UserAvatar
				discordId={team.captainUserId}
				displayName={team.captainName}
				imageUrl={team.captainProfileIconUrl}
				size="sm"
			/>
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-1.5">
					<div className="badge badge-info badge-sm">팀{team.teamIndex}</div>
					<span className="badge badge-warning badge-sm">👑</span>
				</div>
				<div className="font-bold text-sm truncate">{team.captainName}</div>
				<div className="text-xs text-base-content/60 tabular-nums">
					초기 {team.initialPoints}p · 사용 {team.initialPoints - team.currentPoints}p
				</div>
			</div>
		</div>
	);
}
