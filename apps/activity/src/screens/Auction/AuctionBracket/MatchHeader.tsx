import { StatusBadge } from "../../../components/DesignPrimitives.js";
import { type AuctionMatch, type AuctionTournamentDetail, roundLabel } from "../types.js";

export function MatchHeader({
	match,
	inProgress,
	completed,
	winningTeam,
	team1,
	team2,
}: {
	match: AuctionMatch;
	inProgress: boolean;
	completed: boolean;
	winningTeam: "TEAM_1" | "TEAM_2" | null;
	team1: AuctionTournamentDetail["teams"][number] | undefined;
	team2: AuctionTournamentDetail["teams"][number] | undefined;
}) {
	return (
		<div className="flex items-center justify-between flex-wrap gap-2">
			<div className="flex items-center gap-2">
				<span className="text-base font-bold">{roundLabel(match.round, match.bracketIndex)}</span>
				<StatusBadge tone="neutral" variant="ghost">
					{match.format}
				</StatusBadge>
				{inProgress && (
					<StatusBadge tone="warning" className="gap-1.5">
						<span className="inline-block size-2 rounded-full bg-warning-content animate-pulse" />
						진행 중
					</StatusBadge>
				)}
				{completed && (
					<StatusBadge tone="success">
						🏆 팀{winningTeam === "TEAM_1" ? team1?.teamIndex : team2?.teamIndex} 승
					</StatusBadge>
				)}
			</div>
		</div>
	);
}
