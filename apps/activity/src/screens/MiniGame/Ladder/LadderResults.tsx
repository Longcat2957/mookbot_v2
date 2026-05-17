import { TRACE_COLORS } from "./constants.js";
import type { InputState } from "./ladderLogic.js";

export function LadderResults({
	anyDone,
	inputLabels,
	inputs,
	inputStates,
	outputLabels,
	results,
}: {
	anyDone: boolean;
	inputLabels: string[];
	inputs: number[];
	inputStates: Record<number, InputState>;
	outputLabels: string[];
	results: number[];
}) {
	return (
		<div className="mg-ladder-results" aria-live="polite">
			{anyDone && (
				<div>
					<div className="mg-section-title mb-2">결과</div>
					<div className="mg-ladder-result-grid">
						{inputs.map((i) => {
							if (inputStates[i] !== "done") return null;
							const out = results[i];
							if (out === undefined) return null;
							return (
								<div key={`res-${i}`} className="mg-ladder-result-card">
									<span
										className="inline-block w-3 h-3 rounded-full shrink-0"
										style={{ background: TRACE_COLORS[i % TRACE_COLORS.length] }}
									/>
									<span className="font-medium truncate">{inputLabels[i]}</span>
									<span className="text-base-content/40">→</span>
									<span className="font-bold truncate">{outputLabels[out]}</span>
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
