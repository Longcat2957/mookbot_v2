import { PlayerRow } from "./PlayerRow.js";
import type { BalanceParticipant } from "./types.js";

export function MatchupRows({
	activeLanes,
	byTeamLane,
	t1Border,
	t2Border,
	openKeys,
	onToggle,
}: {
	activeLanes: readonly string[];
	byTeamLane: Map<string, BalanceParticipant>;
	t1Border: string;
	t2Border: string;
	openKeys: Set<string>;
	onToggle: (key: string, open: boolean) => void;
}) {
	return (
		<div className="space-y-1.5">
			{activeLanes.map((lane) => {
				const t1 = byTeamLane.get(`TEAM_1_${lane}`);
				const t2 = byTeamLane.get(`TEAM_2_${lane}`);
				if (!t1 || !t2) return null;
				return (
					<div key={lane} className="grid grid-cols-2 gap-2 items-start">
						<PlayerRow
							player={t1}
							lane={lane}
							borderColor={t1Border}
							nameAlign="left"
							isOpen={openKeys.has(`TEAM_1_${lane}`)}
							onToggle={(open) => onToggle(`TEAM_1_${lane}`, open)}
						/>
						<PlayerRow
							player={t2}
							lane={lane}
							borderColor={t2Border}
							nameAlign="left"
							isOpen={openKeys.has(`TEAM_2_${lane}`)}
							onToggle={(open) => onToggle(`TEAM_2_${lane}`, open)}
						/>
					</div>
				);
			})}
		</div>
	);
}
