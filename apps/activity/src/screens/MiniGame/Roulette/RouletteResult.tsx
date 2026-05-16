import { type Phase, SEGMENT_COLORS } from "./constants.js";

export function RouletteResult({
	phase,
	resultIdx,
	labels,
}: {
	phase: Phase;
	resultIdx: number | null;
	labels: string[];
}) {
	return (
		<div className="min-h-[3rem]" aria-live="polite">
			{phase === "settled" && resultIdx !== null && (
				<div className="rounded-md bg-base-100/60 border border-base-300 p-3">
					<div className="text-xs text-base-content/50">결과</div>
					<div
						className="text-2xl sm:text-3xl font-bold truncate"
						style={{ color: SEGMENT_COLORS[resultIdx % SEGMENT_COLORS.length] }}
					>
						{labels[resultIdx]}
					</div>
				</div>
			)}
			{phase === "spinning" && <div className="text-base-content/50 text-sm">돌리는 중...</div>}
			{phase === "idle" && <div className="text-base-content/40 text-sm">대기 중</div>}
		</div>
	);
}
