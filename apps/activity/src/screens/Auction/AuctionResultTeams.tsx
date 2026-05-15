import { PanelCard, SectionHeader, StatusBadge } from "../../components/DesignPrimitives.js";
import { UserAvatar } from "../../components/UserAvatar.js";
import type { AuctionTournamentDetail } from "./types.js";

export function AuctionResultTeams({
	detail,
	runnerUpTeamId,
}: {
	detail: AuctionTournamentDetail;
	runnerUpTeamId: number | null;
}) {
	return (
		<div className="space-y-2">
			<SectionHeader title={<span className="text-lg">전체 팀</span>} />
			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				{detail.teams.map((t) => {
					const isChamp = t.id === detail.tournament.championTeamId;
					const isRunnerUp = t.id === runnerUpTeamId;
					return (
						<PanelCard
							key={t.id}
							status={isChamp ? "success" : isRunnerUp ? "info" : "neutral"}
							bodyClassName="p-4 gap-2"
						>
							<div className="flex items-center gap-2 flex-wrap">
								<StatusBadge tone="info" size="lg">
									팀{t.teamIndex}
								</StatusBadge>
								<StatusBadge tone="warning" size="sm">
									👑
								</StatusBadge>
								<span className="font-bold text-base truncate">{t.captainName}</span>
								{isChamp && (
									<StatusBadge tone="success" className="ml-auto">
										🏆 우승
									</StatusBadge>
								)}
								{isRunnerUp && (
									<StatusBadge tone="info" className="ml-auto">
										🥈 준우승
									</StatusBadge>
								)}
							</div>
							<div className="flex flex-wrap gap-2">
								{t.members.map((m) => (
									<div key={m.userId} className="flex items-center gap-1.5 text-sm">
										<UserAvatar
											discordId={m.userId}
											displayName={m.displayName}
											imageUrl={m.profileIconUrl}
											size="xs"
										/>
										<span className="max-w-[6rem] truncate">{m.displayName}</span>
									</div>
								))}
							</div>
						</PanelCard>
					);
				})}
			</div>
		</div>
	);
}
