import { ChampCell } from "../ChampCell.js";
import type { ActiveSlot, Champion, PickUsage } from "../types.js";

export function UsableChampionGrid({
	filterMode,
	search,
	activeSlot,
	mainsCount,
	usable,
	previousPicks,
	onCommitChampion,
}: {
	filterMode: "all" | "mains";
	search: string;
	activeSlot: ActiveSlot | null;
	mainsCount: number;
	usable: Champion[];
	previousPicks?: Map<number, PickUsage[]> | undefined;
	onCommitChampion: (championId: number) => void;
}) {
	if (filterMode !== "all") return null;
	if (usable.length === 0) {
		if (mainsCount > 0) return null;
		return (
			<div className="text-center text-sm text-base-content/50 py-6">
				{search.trim() ? `"${search}" 검색 결과 없음` : "사용 가능한 챔프가 없습니다."}
			</div>
		);
	}

	return (
		<div>
			{mainsCount > 0 && (
				<div className="text-xs text-base-content/60 mb-1.5">전체 ({usable.length})</div>
			)}
			<div className="grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-1.5">
				{usable.map((champion) => (
					<ChampCell
						key={champion.id}
						champ={champion}
						disabled={!activeSlot}
						reason={!activeSlot ? "슬롯 먼저 선택" : champion.name}
						previousUsage={previousPicks?.get(champion.id)}
						onClick={() => onCommitChampion(champion.id)}
					/>
				))}
			</div>
		</div>
	);
}
