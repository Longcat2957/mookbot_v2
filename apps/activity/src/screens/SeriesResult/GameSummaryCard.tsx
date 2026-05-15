import { StatusBadge } from "../../components/DesignPrimitives.js";
import type { LineupParticipant } from "../../components/LineupPreview.js";
import { GameTeamPanel } from "./GameTeamPanel.js";
import { type Champion, type GameDetail, type Team, teamLabel } from "./types.js";

export function GameSummaryCard({
	game,
	participants,
	champById,
	onSelectUser,
}: {
	game: GameDetail;
	participants: LineupParticipant[];
	champById: Map<number, Champion>;
	onSelectUser?: (userId: string) => void;
}) {
	const lineup = new Map<string, LineupParticipant>();
	for (const participant of participants)
		lineup.set(`${participant.team}_${participant.role}`, participant);

	const teamSize = participants.length / 2;
	const blueTeam: Team = game.team1Side === "BLUE" ? "TEAM_1" : "TEAM_2";
	const redTeam: Team = blueTeam === "TEAM_1" ? "TEAM_2" : "TEAM_1";
	const duration = game.durationSec
		? `${Math.floor(game.durationSec / 60)}분 ${game.durationSec % 60}초`
		: null;
	const winnerSide = game.winningTeam === blueTeam ? "BLUE" : "RED";

	return (
		<details className="collapse collapse-arrow bg-base-200" open>
			<summary className="collapse-title min-h-0 py-3 px-4 flex items-center justify-between gap-2 flex-wrap">
				<div className="flex items-center gap-2">
					<span className="font-bold text-base">Game {game.gameNumber}</span>
					<StatusBadge tone="success">
						{teamLabel(game.winningTeam)} 승 ({winnerSide})
					</StatusBadge>
				</div>
				<div className="text-xs text-base-content/60 flex items-center gap-2">
					{duration && <span>⏱ {duration}</span>}
				</div>
			</summary>
			<div className="collapse-content px-4 pb-4">
				<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
					{[blueTeam, redTeam].map((team) => (
						<GameTeamPanel
							key={team}
							blueTeam={blueTeam}
							champById={champById}
							game={game}
							lineup={lineup}
							{...(onSelectUser ? { onSelectUser } : {})}
							team={team}
							teamSize={teamSize}
						/>
					))}
				</div>
			</div>
		</details>
	);
}
