import { LadderActions } from "./Ladder/LadderActions.js";
import { LadderControls } from "./Ladder/LadderControls.js";
import { LadderLabelGrid } from "./Ladder/LadderLabelGrid.js";
import { LadderResults } from "./Ladder/LadderResults.js";
import { LadderStage } from "./Ladder/LadderStage.js";
import { useLadderState } from "./Ladder/useLadderState.js";

export function Ladder() {
	const ladder = useLadderState();

	return (
		<div className="flex flex-col gap-3 py-2">
			<LadderControls
				count={ladder.count}
				isLocked={ladder.isLocked}
				onCountChange={ladder.setCount}
			/>
			<LadderLabelGrid
				disabled={ladder.isLocked}
				items={ladder.inputs}
				labels={ladder.inputLabels}
				kind="input"
				onChange={ladder.setInputLabels}
			/>
			<div className="text-xs text-base-content/60 text-center">
				↓ 위쪽 색깔 동그라미를 눌러 한 명씩 사다리 결과 확인
			</div>
			<LadderStage
				geom={ladder.geom}
				inputLabels={ladder.inputLabels}
				inputs={ladder.inputs}
				inputStates={ladder.inputStates}
				outputs={ladder.outputs}
				pathsByInput={ladder.pathsByInput}
				rungDelays={ladder.rungDelays}
				rungs={ladder.rungs}
				rungsKey={ladder.rungsKey}
				onStartInput={ladder.startInput}
			/>
			<LadderLabelGrid
				disabled={ladder.isLocked}
				items={ladder.outputs}
				labels={ladder.outputLabels}
				kind="output"
				onChange={ladder.setOutputLabels}
			/>
			<LadderResults
				anyDone={ladder.anyDone}
				inputLabels={ladder.inputLabels}
				inputs={ladder.inputs}
				inputStates={ladder.inputStates}
				outputLabels={ladder.outputLabels}
				results={ladder.results}
			/>
			<LadderActions allDone={ladder.allDone} onReset={ladder.reset} onStartAll={ladder.startAll} />
		</div>
	);
}
