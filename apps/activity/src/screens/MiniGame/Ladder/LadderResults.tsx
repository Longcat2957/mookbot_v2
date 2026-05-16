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
				<div className="rounded-lg border border-base-300 bg-base-100/80 p-3">
					<div className="text-xs text-base-content/60 mb-2 font-semibold">결과</div>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-sm">
						{inputs.map((i) => {
							if (inputStates[i] !== "done") return null;
							const out = results[i];
							if (out === undefined) return null;
							return (
								<div
									key={`res-${i}`}
									className="flex items-center gap-2 rounded-md bg-base-200/60 px-2 py-1.5 min-w-0"
								>
									<span
										className="inline-block w-3 h-3 rounded-full"
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
