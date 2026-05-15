import type { AuctionTournamentDetail } from "../types.js";
import { ChampSlotButton } from "./ChampSlotButton.js";
import {
	type Champion,
	type ChampPickerTarget,
	type GameTeam,
	ROLE_ORDER,
	type Role,
	type RoleAssignment,
	type RolePicks,
} from "./gameInputTypes.js";

export function PickInputGrid({
	assign,
	picks,
	champById,
	team1,
	team2,
	onAssign,
	onOpenPicker,
}: {
	assign: RoleAssignment;
	picks: RolePicks;
	champById: Map<number, Champion>;
	team1: AuctionTournamentDetail["teams"][number];
	team2: AuctionTournamentDetail["teams"][number];
	onAssign: (team: GameTeam, role: Role, userId: string | undefined) => void;
	onOpenPicker: (target: ChampPickerTarget) => void;
}) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
			{(["TEAM_1", "TEAM_2"] as const).map((team) => {
				const members = team === "TEAM_1" ? team1.members : team2.members;
				return (
					<div key={team} className="card bg-base-100 border border-base-300">
						<div className="card-body p-2 gap-1">
							<div className="font-bold text-xs">
								⚔️ PICK — {team === "TEAM_1" ? `팀${team1.teamIndex}` : `팀${team2.teamIndex}`}
							</div>
							{ROLE_ORDER.map((role) => (
								<div key={role} className="flex items-center gap-1 text-xs">
									<span className="w-8 font-medium">{role.slice(0, 3)}</span>
									<select
										value={assign[team][role] ?? ""}
										onChange={(e) => onAssign(team, role, e.target.value || undefined)}
										className="select select-bordered select-xs flex-1 min-w-0"
									>
										<option value="">- 선택 -</option>
										{members.map((m) => (
											<option key={m.userId} value={m.userId}>
												{m.displayName}
											</option>
										))}
									</select>
									<ChampSlotButton
										champion={picks[team][role] != null ? champById.get(picks[team][role]) : undefined}
										onClick={() => onOpenPicker({ kind: "pick", team, role })}
									/>
								</div>
							))}
						</div>
					</div>
				);
			})}
		</div>
	);
}
