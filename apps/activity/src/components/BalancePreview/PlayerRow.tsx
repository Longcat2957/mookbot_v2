import { winrateBadgeClass as wrColorClass } from "../../state/winrateColor.js";
import { type BalanceParticipant, LANE_LABEL } from "./types.js";

export function PlayerRow({
	player,
	lane,
	borderColor,
	nameAlign,
	isOpen,
	onToggle,
}: {
	player: BalanceParticipant;
	lane: string;
	borderColor: string;
	nameAlign: "left" | "right";
	isOpen: boolean;
	onToggle: (open: boolean) => void;
}) {
	const top5 = (player.history.topChampionsByRole[player.role] ?? []).slice(0, 5);
	const alignClass = nameAlign === "right" ? "text-right" : "text-left";

	return (
		<details
			className={`collapse collapse-arrow bg-base-100 border-l-4 ${borderColor}`}
			open={isOpen}
			onToggle={(e) => onToggle(e.currentTarget.open)}
		>
			<summary className="collapse-title min-h-0 py-1.5 px-2.5 text-sm">
				<div className="flex items-center justify-between gap-1.5 pr-8">
					<div className="flex items-center gap-1.5 min-w-0">
						<span className="badge badge-xs badge-ghost shrink-0">{LANE_LABEL[lane] ?? lane}</span>
						<span className={`font-semibold truncate ${alignClass}`}>{player.displayName}</span>
					</div>
					<span className="tabular-nums text-xs text-base-content/60 shrink-0">{player.laneMmr}</span>
				</div>
			</summary>
			<div className="collapse-content px-2.5 pb-2.5">
				<div className="text-[10px] uppercase tracking-wide text-base-content/50 mb-1">
					{LANE_LABEL[lane] ?? lane} 라인 내전 챔프 Top 5
				</div>
				{top5.length === 0 ? (
					<div className="text-xs italic text-base-content/40 py-2">이 라인 내전 기록 없음</div>
				) : (
					<ul className="space-y-1">
						{top5.map((champion) => {
							const wr = champion.plays > 0 ? Math.round((champion.wins / champion.plays) * 100) : 0;
							return (
								<li key={champion.championId} className="flex items-center gap-1.5 text-xs">
									{champion.iconUrl && (
										<img src={champion.iconUrl} alt="" className="size-5 rounded shrink-0" loading="lazy" />
									)}
									<span className="flex-1 truncate">{champion.championName}</span>
									<span className="tabular-nums text-base-content/60 shrink-0">
										{champion.wins}승 {champion.losses}패
									</span>
									<span className={`badge badge-xs ${wrColorClass(wr)} shrink-0`}>{wr}%</span>
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</details>
	);
}
