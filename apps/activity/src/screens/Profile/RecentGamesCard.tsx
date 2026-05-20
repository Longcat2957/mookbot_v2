import { PanelCard, SectionHeader, StatusBadge } from "../../components/DesignPrimitives.js";
import type { RecentGame } from "./types.js";
import { ROLE_LABEL } from "./types.js";

export function RecentGamesCard({
	games,
	onSelectSeries,
}: {
	games: RecentGame[];
	onSelectSeries: (seriesId: number) => void;
}) {
	return (
		<PanelCard surface="soft" bodyClassName="p-3 h-full">
			<SectionHeader
				title={<span className="text-base">최근 게임</span>}
				description="클릭하면 해당 시리즈 결과로 이동합니다."
			/>
			{games.length === 0 ? (
				<div className="min-h-32 flex items-center text-sm text-base-content/50">
					최근 게임 기록이 없습니다.
				</div>
			) : (
				<ul className="space-y-1.5 max-h-[52vh] sm:max-h-[460px] overflow-y-auto pr-1 mt-2">
					{games.map((game) => (
						<RecentGameItem key={game.gameId} game={game} onClick={() => onSelectSeries(game.seriesId)} />
					))}
				</ul>
			)}
		</PanelCard>
	);
}

function RecentGameItem({ game, onClick }: { game: RecentGame; onClick: () => void }) {
	const sideColor = game.side === "BLUE" ? "text-info" : "text-error";
	const playedAt = new Date(game.playedAt * 1000).toLocaleDateString("ko-KR", {
		month: "numeric",
		day: "numeric",
	});
	return (
		<li>
			<button
				type="button"
				onClick={onClick}
				className="w-full flex min-h-14 items-center gap-2 text-left p-1.5 rounded-md hover:bg-base-100/70 transition"
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
						<StatusBadge tone={game.won ? "info" : "error"} size="xs">
							{game.won ? "W" : "L"}
						</StatusBadge>
						<span className="min-w-0 truncate text-base-content/60">
							시리즈 #{game.seriesId} · G{game.gameNumber}
						</span>
						<span className={`${sideColor} ml-auto font-medium`}>{game.side}</span>
					</div>
					<div className="text-sm font-medium truncate">{game.championName ?? "—"}</div>
					<div className="text-xs text-base-content/60 tabular-nums flex flex-wrap items-center gap-x-2 gap-y-0.5">
						<span>{ROLE_LABEL[game.role] ?? game.role}</span>
						<span>{playedAt}</span>
						{game.mmrAfter !== null && <span>MMR {game.mmrAfter}</span>}
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
