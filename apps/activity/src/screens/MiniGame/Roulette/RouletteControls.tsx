import { MAX_COUNT, MIN_COUNT } from "./constants.js";

export function RouletteControls({
	count,
	labels,
	isLocked,
	onCountChange,
	onLabelChange,
}: {
	count: number;
	labels: string[];
	isLocked: boolean;
	onCountChange: (count: number) => void;
	onLabelChange: (index: number, value: string) => void;
}) {
	return (
		<>
			<div className="space-y-2 self-stretch">
				<label className="text-sm font-medium" htmlFor="roulette-count">
					인원
				</label>
				<div className="flex items-center gap-3">
					<input
						id="roulette-count"
						type="range"
						min={MIN_COUNT}
						max={MAX_COUNT}
						value={count}
						onChange={(e) => onCountChange(Number(e.target.value))}
						disabled={isLocked}
						className="range range-sm range-primary flex-1 min-w-0"
					/>
					<span className="badge badge-neutral tabular-nums shrink-0">{count}명</span>
				</div>
			</div>
			<div className="mg-label-grid self-stretch">
				{labels.map((label, index) => (
					<input
						// biome-ignore lint/suspicious/noArrayIndexKey: index is the stable roulette segment identity.
						key={`lab-${index}`}
						type="text"
						value={label}
						onChange={(e) => onLabelChange(index, e.target.value)}
						disabled={isLocked}
						maxLength={10}
						className="input input-xs input-bordered text-center"
						aria-label={`섹션 ${index + 1} 라벨`}
						style={{ borderLeft: `4px solid ${SEGMENT_COLORS[index % SEGMENT_COLORS.length]}` }}
					/>
				))}
			</div>
		</>
	);
}

import { SEGMENT_COLORS } from "./constants.js";
