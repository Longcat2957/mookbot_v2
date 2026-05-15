import { UserAvatar } from "../UserAvatar.js";
import type { SearchHit } from "./types.js";

export function SearchDropdown({
	query,
	hits,
	loading,
	activeIdx,
	onSelect,
	onHover,
}: {
	query: string;
	hits: SearchHit[];
	loading: boolean;
	activeIdx: number;
	onSelect: (hit: SearchHit) => void;
	onHover: (index: number) => void;
}) {
	return (
		<div className="absolute top-full left-0 right-0 mt-1 z-30 bg-base-100 rounded-box shadow-lg border border-base-300 max-h-80 overflow-y-auto">
			{loading && hits.length === 0 ? (
				<div className="px-3 py-2 text-sm text-base-content/50">검색 중...</div>
			) : hits.length === 0 ? (
				<div className="px-3 py-2 text-sm text-base-content/50">
					{query.trim() ? `"${query}" 매칭 없음` : "닉네임을 입력하세요"}
				</div>
			) : (
				hits.map((hit, index) => (
					<SearchResultButton
						key={hit.discordId}
						hit={hit}
						active={index === activeIdx}
						onSelect={onSelect}
						onHover={() => onHover(index)}
					/>
				))
			)}
		</div>
	);
}

function SearchResultButton({
	hit,
	active,
	onSelect,
	onHover,
}: {
	hit: SearchHit;
	active: boolean;
	onSelect: (hit: SearchHit) => void;
	onHover: () => void;
}) {
	return (
		<button
			type="button"
			onClick={() => onSelect(hit)}
			onMouseEnter={onHover}
			className={`w-full text-left px-3 py-2 transition flex items-center gap-3 ${
				active ? "bg-base-200" : "hover:bg-base-200/60"
			}`}
		>
			<UserAvatar
				discordId={hit.discordId}
				displayName={hit.displayName}
				imageUrl={hit.profileIconUrl ?? hit.topChampion?.iconUrl ?? hit.topChampion?.splashUrl ?? null}
				size="sm"
			/>
			<div className="min-w-0 flex-1">
				<div className="font-medium truncate text-sm">{hit.displayName}</div>
				{hit.mainAccount && (
					<div className="text-xs text-base-content/60 truncate tabular-nums">
						{hit.mainAccount.gameName}
						<span className="opacity-50">#{hit.mainAccount.tagLine}</span>
					</div>
				)}
			</div>
			<span className="text-xs text-base-content/40 shrink-0">→</span>
		</button>
	);
}
