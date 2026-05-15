import type { RefObject } from "react";

export function ChampionSearchHeader({
	searchRef,
	search,
	onSearchChange,
	onClearSearch,
	availableCount,
	blockedCount,
}: {
	searchRef: RefObject<HTMLInputElement | null>;
	search: string;
	onSearchChange: (value: string) => void;
	onClearSearch: () => void;
	availableCount: number;
	blockedCount: number;
}) {
	return (
		<div className="flex items-center gap-2 flex-wrap">
			<div className="join flex-1 min-w-[200px]">
				<input
					ref={searchRef}
					type="text"
					placeholder="챔피언 검색... (한/영, / 키로 포커스)"
					value={search}
					onChange={(e) => onSearchChange(e.target.value)}
					className="input input-bordered join-item flex-1"
				/>
				<button
					type="button"
					className="btn btn-ghost join-item"
					onClick={onClearSearch}
					disabled={!search}
					title="검색 초기화 (Esc)"
					aria-label="검색 초기화"
				>
					✕
				</button>
			</div>
			<div className="text-xs text-base-content/60">
				{availableCount} 사용 가능
				{blockedCount > 0 && ` · ${blockedCount} 사용 불가`}
			</div>
		</div>
	);
}
