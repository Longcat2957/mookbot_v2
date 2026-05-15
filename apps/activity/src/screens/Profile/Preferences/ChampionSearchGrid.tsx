import type { MutableRefObject } from "react";
import { ChampCell } from "../../PickBan/ChampCell.js";
import type { Champion } from "../../PickBan/types.js";

export function ChampionSearchGrid({
	atLimit,
	championsLoaded,
	filtered,
	maxPerRole,
	onSearchChange,
	onToggle,
	search,
	searchRef,
	selectedSet,
}: {
	atLimit: boolean;
	championsLoaded: boolean;
	filtered: Champion[];
	maxPerRole: number;
	onSearchChange: (search: string) => void;
	onToggle: (id: number) => void;
	search: string;
	searchRef: MutableRefObject<HTMLInputElement | null>;
	selectedSet: Set<number>;
}) {
	return (
		<div className="space-y-2">
			<div className="join w-full">
				<input
					ref={searchRef}
					type="text"
					placeholder="챔피언 검색… (한/영, Esc 로 초기화)"
					value={search}
					onChange={(e) => onSearchChange(e.target.value)}
					className="input input-bordered input-sm join-item flex-1"
				/>
				<button
					type="button"
					className="btn btn-sm btn-ghost join-item"
					onClick={() => onSearchChange("")}
					disabled={!search}
					aria-label="검색 초기화"
				>
					✕
				</button>
			</div>

			{!championsLoaded ? (
				<div className="skeleton h-48 w-full" />
			) : filtered.length === 0 ? (
				<div className="text-center text-sm text-base-content/50 py-6">"{search}" 검색 결과 없음</div>
			) : (
				<div className="grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-1.5 max-h-[300px] overflow-y-auto pr-1">
					{filtered.map((champ) => {
						const picked = selectedSet.has(champ.id);
						return (
							<div key={champ.id} className={picked ? "ring-2 ring-primary rounded-md" : ""}>
								<ChampCell
									champ={champ}
									disabled={!picked && atLimit}
									reason={
										picked
											? `${champ.name} — 클릭으로 제거`
											: atLimit
												? `최대 ${maxPerRole}개 한도 도달`
												: champ.name
									}
									onClick={() => onToggle(champ.id)}
								/>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
