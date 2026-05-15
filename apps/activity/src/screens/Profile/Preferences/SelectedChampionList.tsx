import type { Champion } from "../../PickBan/types.js";

export function SelectedChampionList({
	atLimit,
	champById,
	maxPerRole,
	onMove,
	onRemove,
	selected,
}: {
	atLimit: boolean;
	champById: Map<number, Champion>;
	maxPerRole: number;
	onMove: (idx: number, dir: -1 | 1) => void;
	onRemove: (idx: number) => void;
	selected: number[];
}) {
	return (
		<div className="mb-3">
			<div className="flex items-center justify-between mb-1">
				<span className="text-xs text-base-content/60">선택된 챔프 (순서대로 저장됨)</span>
				<span
					className={`text-xs tabular-nums ${atLimit ? "text-warning font-semibold" : "text-base-content/60"}`}
				>
					{selected.length} / {maxPerRole}
				</span>
			</div>
			{selected.length === 0 ? (
				<div className="text-xs text-base-content/40 py-2 px-2">
					아직 선택된 챔프가 없습니다 — 아래 그리드에서 클릭하세요.
				</div>
			) : (
				<div className="flex flex-wrap gap-1.5 bg-base-200/40 rounded p-2">
					{selected.map((id, idx) => {
						const champ = champById.get(id);
						return (
							<div
								key={id}
								className="flex items-center gap-1 bg-base-100 rounded pl-1 pr-0.5 py-0.5 border border-base-300"
							>
								{champ?.iconUrl && (
									<img
										src={champ.iconUrl}
										alt={champ.name}
										width={20}
										height={20}
										className="w-5 h-5 rounded"
										loading="lazy"
										decoding="async"
									/>
								)}
								<span className="text-xs">{champ?.name ?? `#${id}`}</span>
								<button
									type="button"
									className="btn btn-ghost btn-xs min-h-0 h-5 px-1"
									onClick={() => onMove(idx, -1)}
									disabled={idx === 0}
									aria-label="앞으로"
									title="앞으로"
								>
									‹
								</button>
								<button
									type="button"
									className="btn btn-ghost btn-xs min-h-0 h-5 px-1"
									onClick={() => onMove(idx, 1)}
									disabled={idx === selected.length - 1}
									aria-label="뒤로"
									title="뒤로"
								>
									›
								</button>
								<button
									type="button"
									className="btn btn-ghost btn-xs min-h-0 h-5 px-1 text-error"
									onClick={() => onRemove(idx)}
									aria-label={`${champ?.name ?? `#${id}`} 제거`}
									title="제거"
								>
									✕
								</button>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
