import { MiniGameSection } from "../shared.js";
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
		<MiniGameSection
			title="인원"
			trailing={<span className="badge badge-neutral tabular-nums shrink-0">{count}명</span>}
		>
			<div className="flex items-center gap-3">
				<input
					id="ladder-count"
					aria-label="사다리 인원"
					type="range"
					min={MIN_COUNT}
					max={MAX_COUNT}
					value={count}
					onChange={(e) => onCountChange(Number(e.target.value))}
					disabled={isLocked}
					className="range range-sm range-primary flex-1 min-w-0"
				/>
			</div>
		</MiniGameSection>
	);
}
