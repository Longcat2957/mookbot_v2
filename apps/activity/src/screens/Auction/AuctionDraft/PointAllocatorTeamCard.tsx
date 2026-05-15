import type { CSSProperties } from "react";
import { UserAvatar } from "../../../components/UserAvatar.js";
import type { AuctionTeam } from "../types.js";

export function PointAllocatorTeamCard({
	team,
	points,
	canEdit,
	onChange,
}: {
	team: AuctionTeam;
	points: number;
	canEdit: boolean;
	onChange: (points: number) => void;
}) {
	const pct = Math.round((points / 1000) * 50);

	return (
		<div className="card bg-base-100">
			<div className="card-body p-4 gap-2.5">
				<div className="flex items-center gap-3">
					<div
						className="radial-progress text-warning tabular-nums"
						style={{ "--value": pct, "--size": "4rem", "--thickness": "5px" } as CSSProperties}
						aria-valuenow={pct}
						role="progressbar"
					>
						<span className="text-sm font-bold">{points}p</span>
					</div>
					<UserAvatar
						discordId={team.captainUserId}
						displayName={team.captainName}
						imageUrl={team.captainProfileIconUrl}
						size="sm"
					/>
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-1.5">
							<div className="badge badge-info badge-lg">팀{team.teamIndex}</div>
							<span className="badge badge-warning badge-sm">👑</span>
						</div>
						<div className="font-bold text-base truncate">{team.captainName}</div>
					</div>
				</div>
				<input
					type="number"
					value={points}
					onChange={(e) => onChange(Number(e.target.value))}
					disabled={!canEdit}
					min={0}
					step={50}
					className="input input-bordered w-full text-right tabular-nums text-lg font-bold"
				/>
			</div>
		</div>
	);
}
