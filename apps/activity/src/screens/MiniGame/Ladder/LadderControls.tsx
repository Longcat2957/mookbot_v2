import { MAX_COUNT, MIN_COUNT } from "./constants.js";

export function LadderControls({
	count,
	isLocked,
	onCountChange,
}: {
	count: number;
	isLocked: boolean;
	onCountChange: (count: number) => void;
}) {
	return (
		<div className="flex items-center gap-3 flex-wrap">
			<label className="text-sm font-medium" htmlFor="ladder-count">
				인원
			</label>
			<input
				id="ladder-count"
				type="range"
				min={MIN_COUNT}
				max={MAX_COUNT}
				value={count}
				onChange={(e) => onCountChange(Number(e.target.value))}
				disabled={isLocked}
				className="range range-sm range-primary max-w-xs flex-1 min-w-32"
			/>
			<span className="badge badge-neutral tabular-nums">{count}명</span>
		</div>
	);
}
