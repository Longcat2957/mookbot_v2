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
				<div
					className="text-2xl sm:text-3xl font-bold"
					style={{ color: SEGMENT_COLORS[resultIdx % SEGMENT_COLORS.length] }}
				>
					🎯 {labels[resultIdx]}
				</div>
			)}
			{phase === "spinning" && <div className="text-base-content/50 text-sm">돌리는 중...</div>}
			{phase === "idle" && <div className="text-base-content/40 text-sm">버튼을 눌러 시작</div>}
		</div>
	);
}
