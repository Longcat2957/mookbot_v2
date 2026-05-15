import type { RecentGame } from "./types.js";

export function RecentGamesCard({
	games,
	onSelectSeries,
}: {
	games: RecentGame[];
	onSelectSeries: (seriesId: number) => void;
}) {
	return (
		<div className="card surface-soft">
			<div className="card-body p-3">
				<h2 className="card-title text-base">🕒 최근 게임</h2>
				{games.length === 0 ? (
					<div className="text-sm text-base-content/50 py-2">최근 게임 기록이 없습니다.</div>
				) : (
					<ul className="space-y-1.5 max-h-[50vh] sm:max-h-[420px] overflow-y-auto pr-1">
						{games.map((game) => (
							<RecentGameItem
								key={game.gameId}
								game={game}
								onClick={() => onSelectSeries(game.seriesId)}
							/>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}

function RecentGameItem({ game, onClick }: { game: RecentGame; onClick: () => void }) {
	const sideColor = game.side === "BLUE" ? "text-info" : "text-error";
	return (
		<li>
			<button
				type="button"
				onClick={onClick}
				className="w-full flex items-center gap-2 text-left p-1.5 rounded hover:bg-base-200/60 transition"
			>
				{game.iconUrl ? (
					<img
						src={game.iconUrl}
						alt={game.championName ?? ""}
						width={36}
						height={36}
						className="w-9 h-9 rounded"
						loading="lazy"
						decoding="async"
					/>
				) : (
					<div className="w-9 h-9 rounded bg-base-300" />
				)}
				<div className="flex-1 min-w-0 leading-tight">
					<div className="flex items-center gap-1.5 text-xs">
						<span className={`font-bold ${game.won ? "text-info" : "text-error"}`}>
							{game.won ? "W" : "L"}
						</span>
						<span className="text-base-content/60">
							시리즈 #{game.seriesId} · G{game.gameNumber}
						</span>
						<span className={`${sideColor} ml-auto font-medium`}>{game.side}</span>
					</div>
					<div className="text-sm font-medium truncate">{game.championName ?? "—"}</div>
					<div className="text-xs text-base-content/60 tabular-nums flex items-center gap-2">
						{game.mmrDelta !== null && (
							<span className={`ml-auto font-semibold ${game.mmrDelta > 0 ? "text-info" : "text-error"}`}>
								{game.mmrDelta > 0 ? "+" : ""}
								{game.mmrDelta}
							</span>
						)}
					</div>
				</div>
			</button>
		</li>
	);
}
