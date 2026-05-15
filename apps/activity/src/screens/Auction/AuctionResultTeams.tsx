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
			<h3 className="text-lg font-bold">전체 팀</h3>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				{detail.teams.map((t) => {
					const isChamp = t.id === detail.tournament.championTeamId;
					const isRunnerUp = t.id === runnerUpTeamId;
					const borderColor = isChamp
						? "border-2 border-success"
						: isRunnerUp
							? "border-2 border-info"
							: "border border-base-300";
					return (
						<div key={t.id} className={`card surface-base shadow-sm ${borderColor}`}>
							<div className="card-body p-4 gap-2">
								<div className="flex items-center gap-2 flex-wrap">
									<div className="badge badge-info badge-lg">팀{t.teamIndex}</div>
									<span className="badge badge-warning badge-sm">👑</span>
									<span className="font-bold text-base truncate">{t.captainName}</span>
									{isChamp && <span className="badge badge-success ml-auto">🏆 우승</span>}
									{isRunnerUp && <span className="badge badge-info ml-auto">🥈 준우승</span>}
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
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
