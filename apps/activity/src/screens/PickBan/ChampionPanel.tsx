import type { RefObject } from "react";
import { BlockedChampionGrid } from "./ChampionPanel/BlockedChampionGrid.js";
import { ChampionFilterTabs } from "./ChampionPanel/ChampionFilterTabs.js";
import { ChampionSearchHeader } from "./ChampionPanel/ChampionSearchHeader.js";
import { MainChampionGrid } from "./ChampionPanel/MainChampionGrid.js";
import { UsableChampionGrid } from "./ChampionPanel/UsableChampionGrid.js";
import type { ActiveSlot, Champion, ChampionPlay, PickUsage, SeriesParticipant } from "./types.js";

export function ChampionPanel({
	searchRef,
	search,
	onSearchChange,
	onClearSearch,
	activeSlot,
	activePlayer,
	filterMode,
	onFilterModeChange,
	fearlessUsedIds,
	mains,
	usable,
	blocked,
	previousPicks,
	onCommitChampion,
}: {
	searchRef: RefObject<HTMLInputElement | null>;
	search: string;
	onSearchChange: (value: string) => void;
	onClearSearch: () => void;
	activeSlot: ActiveSlot | null;
	activePlayer: SeriesParticipant | null;
	filterMode: "all" | "mains";
	onFilterModeChange: (mode: "all" | "mains") => void;
	fearlessUsedIds: Set<number>;
	mains: ChampionPlay[];
	usable: Champion[];
	blocked: { champ: Champion; reason: "used" | "fearless" }[];
	previousPicks?: Map<number, PickUsage[]> | undefined;
	onCommitChampion: (championId: number) => void;
}) {
	return (
		<div className="card surface-base shadow-sm lg:sticky lg:top-2 lg:max-h-[calc(100vh-1rem)] lg:overflow-y-auto">
			<div className="card-body p-4 gap-3">
				<ChampionSearchHeader
					searchRef={searchRef}
					search={search}
					onSearchChange={onSearchChange}
					onClearSearch={onClearSearch}
					availableCount={mains.length + usable.length}
					blockedCount={blocked.length}
				/>
				<ChampionFilterTabs
					activePlayer={activePlayer}
					mainsCount={mains.length}
					filterMode={filterMode}
					onFilterModeChange={onFilterModeChange}
				/>

				{fearlessUsedIds.size > 0 && (
					<div className="text-xs text-base-content/60">
						🛡️ Hard Fearless — 이전 게임에서 사용된 {fearlessUsedIds.size}개 챔프 자동 비활성화
					</div>
				)}

				<MainChampionGrid
					activePlayer={activePlayer}
					activeSlot={activeSlot}
					mains={mains}
					previousPicks={previousPicks}
					onCommitChampion={onCommitChampion}
				/>
				<UsableChampionGrid
					filterMode={filterMode}
					search={search}
					activeSlot={activeSlot}
					mainsCount={mains.length}
					usable={usable}
					previousPicks={previousPicks}
					onCommitChampion={onCommitChampion}
				/>
				<BlockedChampionGrid blocked={blocked} previousPicks={previousPicks} />
			</div>
		</div>
	);
}
