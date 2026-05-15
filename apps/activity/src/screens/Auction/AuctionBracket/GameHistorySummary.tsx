import type { MatchDetail } from "./_shared.js";

export function GameHistorySummary({ games }: { games: MatchDetail["games"] }) {
	if (games.length === 0) return null;

	return (
		<details className="collapse collapse-arrow surface-quiet-soft mt-1">
			<summary className="collapse-title text-sm py-1.5 min-h-0">게임 기록 ({games.length})</summary>
			<div className="collapse-content text-sm">
				{games.map((g) => (
					<div key={g.id} className="py-1">
						<strong>Game {g.gameNumber}</strong> · {g.winningTeam === "TEAM_1" ? "1팀 승" : "2팀 승"} ·{" "}
						{g.team1Side}
					</div>
				))}
			</div>
		</details>
	);
}
