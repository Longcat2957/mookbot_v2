import { PanelCard, SectionHeader, StatusBadge } from "../../components/DesignPrimitives.js";
import type { TopChampion } from "./types.js";

export function TopChampionsCard({ champions }: { champions: TopChampion[] }) {
	return (
		<PanelCard surface="soft" bodyClassName="p-3 h-full">
			<SectionHeader
				title={<span className="text-base">주력 챔프</span>}
				description="시즌 전체 픽 기준 상위 챔피언"
			/>
			{champions.length === 0 ? (
				<div className="min-h-32 flex items-center text-sm text-base-content/50">
					아직 픽 기록이 없습니다.
				</div>
			) : (
				<ul className="space-y-1.5 mt-2">
					{champions.slice(0, 8).map((champion, index) => {
						const wrPct = Math.round(champion.winrate * 100);
						return (
							<li
								key={champion.championId}
								className="flex min-h-12 items-center gap-2.5 rounded-md px-1.5 py-1 hover:bg-base-100/60"
							>
								<div className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-base-content/45">
									{index + 1}
								</div>
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
									<div className="text-xs text-base-content/60 tabular-nums flex flex-wrap items-center gap-1.5">
										<span>
											{champion.plays}G · {champion.wins}-{champion.losses}
										</span>
										<StatusBadge tone={wrPct >= 50 ? "success" : "error"} size="xs">
											{wrPct}%
										</StatusBadge>
									</div>
								</div>
							</li>
						);
					})}
				</ul>
			)}
		</PanelCard>
	);
}
