import { ChampSlotButton } from "./ChampSlotButton.js";
import type { Champion, ChampPickerTarget, GameTeam, TeamBans } from "./gameInputTypes.js";

export function BanInputGrid({
	bans,
	champById,
	team1Index,
	team2Index,
	onOpenPicker,
	onRemoveBan,
}: {
	bans: TeamBans;
	champById: Map<number, Champion>;
	team1Index: number;
	team2Index: number;
	onOpenPicker: (target: ChampPickerTarget) => void;
	onRemoveBan: (team: GameTeam, index: number) => void;
}) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
			{(["TEAM_1", "TEAM_2"] as const).map((team) => (
				<div key={team} className="card bg-base-100 border border-base-300">
					<div className="card-body p-2 gap-1">
						<div className="font-bold text-xs">
							🚫 BAN — {team === "TEAM_1" ? `팀${team1Index}` : `팀${team2Index}`}
						</div>
						<div className="grid grid-cols-5 gap-1">
							{[0, 1, 2, 3, 4].map((i) => {
								const banId = bans[team][i];
								return (
									<ChampSlotButton
										key={i}
										champion={banId != null ? champById.get(banId) : undefined}
										onClick={() => onOpenPicker({ kind: "ban", team, index: i })}
										{...(banId != null ? { onClear: () => onRemoveBan(team, i) } : {})}
									/>
								);
							})}
						</div>
					</div>
				</div>
			))}
		</div>
	);
}
