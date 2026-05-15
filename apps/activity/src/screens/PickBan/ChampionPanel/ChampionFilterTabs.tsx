import type { SeriesParticipant } from "../types.js";

export function ChampionFilterTabs({
	activePlayer,
	mainsCount,
	filterMode,
	onFilterModeChange,
}: {
	activePlayer: SeriesParticipant | null;
	mainsCount: number;
	filterMode: "all" | "mains";
	onFilterModeChange: (mode: "all" | "mains") => void;
}) {
	if (!activePlayer || mainsCount === 0) return null;

	return (
		<div role="tablist" className="tabs tabs-xs tabs-boxed self-start">
			<button
				type="button"
				role="tab"
				className={`tab ${filterMode === "all" ? "tab-active" : ""}`}
				onClick={() => onFilterModeChange("all")}
			>
				전체
			</button>
			<button
				type="button"
				role="tab"
				className={`tab ${filterMode === "mains" ? "tab-active" : ""}`}
				onClick={() => onFilterModeChange("mains")}
			>
				🌟 {activePlayer.displayName} 주력 ({mainsCount})
			</button>
		</div>
	);
}
