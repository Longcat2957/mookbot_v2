import { StatusBadge } from "../../components/DesignPrimitives.js";
import type { SeriesDetail } from "./types.js";

export function GameTabs({
	currentGame,
	detail,
	completedGames,
	isGameTabEnabled,
	onSelectGame,
}: {
	currentGame: number;
	detail: SeriesDetail;
	completedGames: Set<number>;
	isGameTabEnabled: (n: number) => boolean;
	onSelectGame: (n: number) => void;
}) {
	return (
		<div role="tablist" className="tabs tabs-lift">
			{[1, 2, 3].map((n) => {
				const enabled = isGameTabEnabled(n);
				const recorded = completedGames.has(n);
				const game = detail.games.find((g) => g.gameNumber === n);
				const isCurrent = currentGame === n;
				const tip = !enabled
					? `Game ${n - 1} 결과를 먼저 입력하세요`
					: recorded
						? `Game ${n} 결과 기록됨 — 다시 보기`
						: isCurrent
							? `Game ${n} 입력 중`
							: `Game ${n} 입력`;
				const tab = (
					<button
						type="button"
						role="tab"
						className={`tab ${isCurrent ? "tab-active" : ""} ${
							!enabled ? "opacity-40 cursor-not-allowed" : ""
						}`}
						onClick={() => onSelectGame(n)}
						disabled={!enabled}
					>
						<span className="font-medium">Game {n}</span>
						{recorded && game && (
							<StatusBadge
								tone={game.winningTeam === "TEAM_1" ? "info" : "error"}
								size="xs"
								className="ml-1.5"
							>
								{game.winningTeam === "TEAM_1" ? "1팀 W" : "2팀 W"}
							</StatusBadge>
						)}
						{!recorded && isCurrent && enabled && (
							<span
								className="ml-1.5 inline-block size-1.5 rounded-full bg-success animate-pulse"
								role="status"
								aria-label="진행 중"
							/>
						)}
					</button>
				);
				return (
					<span key={n} className="tooltip tooltip-bottom" data-tip={tip}>
						{tab}
					</span>
				);
			})}
		</div>
	);
}
