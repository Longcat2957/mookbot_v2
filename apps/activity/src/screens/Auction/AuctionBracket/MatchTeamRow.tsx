import { UserAvatar } from "../../../components/UserAvatar.js";
import type { AuctionTournamentDetail } from "../types.js";

export function MatchTeamRow({
	team,
	teamSide,
	completed,
	winningTeam,
}: {
	team: AuctionTournamentDetail["teams"][number] | undefined;
	teamSide: "TEAM_1" | "TEAM_2";
	completed: boolean;
	winningTeam: "TEAM_1" | "TEAM_2" | null;
}) {
	if (!team) return null;
	const isWinner = completed && winningTeam === teamSide;
	const isTeam1 = teamSide === "TEAM_1";
	const winnerBg = isWinner
		? isTeam1
			? "bg-info/10 ring-1 ring-info"
			: "bg-error/10 ring-1 ring-error"
		: "surface-quiet-soft";
	const badgeColor = isTeam1 ? "badge-info" : "badge-error";
	return (
		<div className={`p-2.5 rounded-md ${winnerBg}`}>
			<div className="flex items-center gap-2">
				<div className={`badge ${badgeColor} badge-lg`}>팀{team.teamIndex}</div>
				<UserAvatar
					discordId={team.captainUserId}
					displayName={team.captainName}
					imageUrl={team.captainProfileIconUrl}
					size="sm"
				/>
				<div className="flex-1 min-w-0">
					<div className="font-bold text-base truncate flex items-center gap-1">
						<span className="badge badge-warning badge-xs">👑</span>
						{team.captainName}
					</div>
				</div>
				{isWinner && <span className="text-2xl">🏆</span>}
			</div>
			<div className="flex items-center gap-1 mt-2 flex-wrap">
				{team.members.map((m) => (
					<div key={m.userId} className="flex items-center gap-1 text-sm">
						<UserAvatar
							discordId={m.userId}
							displayName={m.displayName}
							imageUrl={m.profileIconUrl}
							size="xs"
						/>
						<span
							className={`truncate max-w-[6rem] ${m.userId === team.captainUserId ? "font-medium" : ""}`}
						>
							{m.displayName}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}
