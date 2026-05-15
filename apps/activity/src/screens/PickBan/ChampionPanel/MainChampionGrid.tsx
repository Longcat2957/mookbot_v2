import { ChampCell } from "../ChampCell.js";
import type { ActiveSlot, ChampionPlay, PickUsage, SeriesParticipant } from "../types.js";

export function MainChampionGrid({
	activePlayer,
	activeSlot,
	mains,
	previousPicks,
	onCommitChampion,
}: {
	activePlayer: SeriesParticipant | null;
	activeSlot: ActiveSlot | null;
	mains: ChampionPlay[];
	previousPicks?: Map<number, PickUsage[]> | undefined;
	onCommitChampion: (championId: number) => void;
}) {
	if (!activePlayer || mains.length === 0) return null;

	return (
		<div>
			<div className="text-xs font-medium text-warning mb-1.5 flex items-center gap-1">
				🌟 주력 챔프 ({activePlayer.displayName})
			</div>
			<div className="grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-1.5">
				{mains.map((main) => (
					<ChampCell
						key={main.championId}
						champ={{
							id: main.championId,
							idSlug: "",
							name: main.championName,
							iconUrl: main.iconUrl,
						}}
						disabled={!activeSlot}
						mainCount={main.plays}
						reason={
							!activeSlot
								? "슬롯 먼저 선택"
								: `${main.championName} · ${main.plays}회 (${main.wins}승 ${main.losses}패)`
						}
						previousUsage={previousPicks?.get(main.championId)}
						onClick={() => onCommitChampion(main.championId)}
					/>
				))}
			</div>
		</div>
	);
}
