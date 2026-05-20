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
			className={`collapse collapse-arrow bg-base-100 border-l-4 shadow-sm ${borderColor}`}
			open={isOpen}
			onToggle={(e) => onToggle(e.currentTarget.open)}
		>
			<summary className="collapse-title min-h-0 py-2 px-3 text-base">
				<div className="flex items-center justify-between gap-1.5 pr-8">
					<div className="flex items-center gap-1.5 min-w-0">
						<span className="badge badge-sm badge-ghost shrink-0 min-w-10 justify-center">
							{LANE_LABEL[lane] ?? lane}
						</span>
						<span className={`font-bold truncate ${alignClass}`}>{player.displayName}</span>
					</div>
					<span className="tabular-nums text-sm font-semibold text-base-content/70 shrink-0">
						{player.laneMmr}
					</span>
				</div>
			</summary>
			<div className="collapse-content px-3 pb-3">
				<div className="text-xs font-semibold uppercase tracking-wide text-base-content/55 mb-2">
					{LANE_LABEL[lane] ?? lane} 라인 내전 챔프 Top 5
				</div>
				{top5.length === 0 ? (
					<div className="rounded-md border border-dashed border-base-content/15 bg-base-200/50 px-3 py-2 text-sm italic text-base-content/45">
						이 라인 내전 기록 없음
					</div>
				) : (
					<ul className="grid grid-cols-1 gap-1.5">
						{top5.map((champion) => {
							const wr = champion.plays > 0 ? Math.round((champion.wins / champion.plays) * 100) : 0;
							return (
								<li
									key={champion.championId}
									className="flex items-center gap-2 rounded-md border border-base-content/10 bg-base-200/60 px-2 py-1.5 text-sm"
								>
									{champion.iconUrl && (
										<img
											src={champion.iconUrl}
											alt=""
											width={32}
											height={32}
											className="size-8 rounded-md shrink-0 object-cover ring-1 ring-base-content/10"
											loading="lazy"
											decoding="async"
										/>
									)}
									<span className="flex-1 truncate font-semibold">{champion.championName}</span>
									<span className="tabular-nums text-xs text-base-content/65 shrink-0">
										{champion.wins}승 {champion.losses}패
									</span>
									<span className={`badge badge-sm ${wrColorClass(wr)} shrink-0 tabular-nums`}>{wr}%</span>
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</details>
	);
}
