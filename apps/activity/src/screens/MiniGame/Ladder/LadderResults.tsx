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
		<div className="min-h-[2.25rem]">
			{anyDone && (
				<div className="rounded-lg border border-base-300 bg-base-100 p-3">
					<div className="text-xs text-base-content/60 mb-2 font-semibold">결과 매핑</div>
					<div className="flex flex-col gap-1 text-sm">
						{inputs.map((i) => {
							if (inputStates[i] !== "done") return null;
							const out = results[i];
							if (out === undefined) return null;
							return (
								<div key={`res-${i}`} className="flex items-center gap-2">
									<span
										className="inline-block w-3 h-3 rounded-full"
										style={{ background: TRACE_COLORS[i % TRACE_COLORS.length] }}
									/>
									<span className="font-medium">{inputLabels[i]}</span>
									<span className="text-base-content/40">→</span>
									<span className="font-bold">{outputLabels[out]}</span>
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
