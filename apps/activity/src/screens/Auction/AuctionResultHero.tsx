import { UserAvatar } from "../../components/UserAvatar.js";
import type { MatchSeriesDetail } from "./resultTypes.js";
import type { AuctionTournamentDetail } from "./types.js";

export function AuctionResultHero({
	detail,
	finalScoreText,
}: {
	detail: AuctionTournamentDetail;
	finalScoreText: string | null;
}) {
	const championTeam = detail.teams.find((t) => t.id === detail.tournament.championTeamId);
	if (!championTeam) return null;

	return (
		<div className="card bg-success/10 border-2 border-success shadow-lg">
			<div className="card-body p-6 gap-3 text-center">
				<div className="text-6xl select-none">🏆</div>
				<div className="text-2xl font-bold">
					우승 · 팀{championTeam.teamIndex} {championTeam.captainName}
				</div>
				{finalScoreText && <div className="text-base text-base-content/60">{finalScoreText}</div>}
				<div className="flex items-end justify-center gap-3 flex-wrap pt-2">
					{championTeam.members.map((m) => (
						<div key={m.userId} className="flex flex-col items-center gap-1.5">
							<div
								className={
									m.userId === championTeam.captainUserId ? "ring-2 ring-warning rounded-full" : ""
								}
							>
								<UserAvatar
									discordId={m.userId}
									displayName={m.displayName}
									imageUrl={m.profileIconUrl}
									size="lg"
								/>
							</div>
							<div className="text-sm font-medium max-w-[6rem] truncate">
								{m.displayName}
								{m.userId === championTeam.captainUserId && " 👑"}
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

export function finalScoreText(
	finalMatch: AuctionTournamentDetail["matches"][number] | undefined,
	finalMd: MatchSeriesDetail | undefined,
) {
	if (!finalMatch || !finalMd) return null;
	const finalT1Wins = finalMd.games.filter((g) => g.winningTeam === "TEAM_1").length;
	const finalT2Wins = finalMd.games.filter((g) => g.winningTeam === "TEAM_2").length;
	return `${finalMatch.format} 결승: ${Math.max(finalT1Wins, finalT2Wins)}-${Math.min(finalT1Wins, finalT2Wins)}`;
}

export function runnerUpTeamId(
	finalMatch: AuctionTournamentDetail["matches"][number] | undefined,
	finalMd: MatchSeriesDetail | undefined,
) {
	if (!finalMatch || !finalMd?.winningTeam) return null;
	return finalMd.winningTeam === "TEAM_1" ? finalMatch.team2Id : finalMatch.team1Id;
}
