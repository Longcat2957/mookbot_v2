import type { TopChampion } from "./types.js";

export function TopChampionsCard({ champions }: { champions: TopChampion[] }) {
	return (
		<div className="card surface-soft">
			<div className="card-body p-3">
				<h2 className="card-title text-base">🌟 주력 챔프</h2>
				{champions.length === 0 ? (
					<div className="text-sm text-base-content/50 py-2">아직 픽 기록이 없습니다.</div>
				) : (
					<ul className="space-y-1.5">
						{champions.map((champion) => {
							const wrPct = Math.round(champion.winrate * 100);
							return (
								<li key={champion.championId} className="flex items-center gap-2.5">
									<img
										src={champion.iconUrl}
										alt={champion.championName}
										width={36}
										height={36}
										className="w-9 h-9 rounded"
										loading="lazy"
										decoding="async"
									/>
									<div className="flex-1 min-w-0">
										<div className="font-medium truncate text-sm">{champion.championName}</div>
										<div className="text-xs text-base-content/60 tabular-nums">
											{champion.plays}G · {champion.wins}-{champion.losses} ({wrPct}%)
										</div>
									</div>
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</div>
	);
}
