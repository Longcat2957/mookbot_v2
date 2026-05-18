import { MiniGameStatusCard } from "../shared.js";
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
	if (phase !== "settled" || resultIdx === null) return null;

	return (
		<MiniGameStatusCard className="mg-roulette-result-card">
			<div
				className="mg-roulette-result-text"
				style={{ color: SEGMENT_COLORS[resultIdx % SEGMENT_COLORS.length] }}
			>
				{labels[resultIdx]}
			</div>
		</MiniGameStatusCard>
	);
}
