import { type ChampionPlay, wrColor } from "./types.js";

export function ChampionTile({ champ }: { champ: ChampionPlay; compact?: boolean }) {
	const wr = champ.plays > 0 ? Math.round((champ.wins / champ.plays) * 100) : 0;
	return (
		<div
			className="tooltip tooltip-top"
			data-tip={`${champ.championName} · ${champ.plays}G ${champ.wins}승 ${champ.losses}패 (${wr}%)`}
		>
			<div className="relative">
				{champ.iconUrl ? (
					<img
						src={champ.iconUrl}
						alt={champ.championName}
						width={36}
						height={36}
						className="w-9 h-9 rounded border border-base-content/20"
						draggable={false}
						loading="lazy"
						decoding="async"
					/>
				) : (
					<div className="w-9 h-9 rounded bg-base-content/10 flex items-center justify-center text-[10px]">
						?
					</div>
				)}
				<span
					className={`absolute -bottom-1 -right-1 text-[9px] font-bold rounded px-0.5 ${wrColor(
						wr,
					)} text-base-100`}
				>
					{wr}%
				</span>
			</div>
		</div>
	);
}
