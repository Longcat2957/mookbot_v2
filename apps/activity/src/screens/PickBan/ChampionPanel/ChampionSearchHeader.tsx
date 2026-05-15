import type { RefObject } from "react";
import { IconButton, StatusBadge } from "../../../components/DesignPrimitives.js";

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
				<IconButton
					label="검색 초기화"
					tooltip="검색 초기화 (Esc)"
					className="join-item rounded-l-none"
					onClick={onClearSearch}
					disabled={!search}
				>
					✕
				</IconButton>
			</div>
			<div className="flex items-center gap-1.5">
				<StatusBadge tone="success" variant="outline">
					{availableCount} 사용 가능
				</StatusBadge>
				{blockedCount > 0 && (
					<StatusBadge tone="warning" variant="outline">
						{blockedCount} 사용 불가
					</StatusBadge>
				)}
			</div>
		</div>
	);
}
