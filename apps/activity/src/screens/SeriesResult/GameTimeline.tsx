import type { LineupParticipant } from "../../components/LineupPreview.js";
import { GameSummaryCard } from "./GameSummaryCard.js";
import type { Champion, GameDetail } from "./types.js";

export function GameTimeline({
	champById,
	games,
	onSelectUser,
	participants,
}: {
	champById: Map<number, Champion>;
	games: GameDetail[];
	onSelectUser?: (userId: string) => void;
	participants: LineupParticipant[];
}) {
	if (games.length === 0) {
		return (
			<div className="alert">
				<span>기록된 게임이 없습니다.</span>
			</div>
		);
	}

	const sortedGames = games.slice().sort((a, b) => a.gameNumber - b.gameNumber);
	return (
		<ul className="timeline timeline-vertical timeline-compact">
			{sortedGames.map((game, i) => {
				const isLast = i === sortedGames.length - 1;
				const dotColor = game.winningTeam === "TEAM_1" ? "bg-info" : "bg-error";
				return (
					<li key={game.id}>
						{i > 0 && <hr className="bg-base-300" />}
						<div className="timeline-middle">
							<div className={`size-3 rounded-full ${dotColor} ring-2 ring-base-100`} aria-hidden="true" />
						</div>
						<div className="timeline-end pb-2 w-full">
							<GameSummaryCard
								game={game}
								participants={participants}
								champById={champById}
								{...(onSelectUser ? { onSelectUser } : {})}
							/>
						</div>
						{!isLast && <hr className="bg-base-300" />}
					</li>
				);
			})}
		</ul>
	);
}
