import { LadderActions } from "./Ladder/LadderActions.js";
import { LadderControls } from "./Ladder/LadderControls.js";
import { LadderLabelGrid } from "./Ladder/LadderLabelGrid.js";
import { LadderResults } from "./Ladder/LadderResults.js";
import { LadderStage } from "./Ladder/LadderStage.js";
import { useLadderState } from "./Ladder/useLadderState.js";

export function Ladder() {
	const ladder = useLadderState();

	return (
		<div className="grid grid-cols-1 xl:grid-cols-[20rem_minmax(0,1fr)] gap-4 min-h-[32rem]">
			<div className="mg-control-panel">
				<LadderControls
					count={ladder.count}
					isLocked={ladder.isLocked}
					onCountChange={ladder.setCount}
				/>
				<div className="space-y-2">
					<div className="text-xs font-semibold text-base-content/60">입력</div>
					<LadderLabelGrid
						disabled={ladder.isLocked}
						items={ladder.inputs}
						labels={ladder.inputLabels}
						kind="input"
						onChange={ladder.setInputLabels}
					/>
				</div>
				<div className="space-y-2">
					<div className="text-xs font-semibold text-base-content/60">출력</div>
					<LadderLabelGrid
						disabled={ladder.isLocked}
						items={ladder.outputs}
						labels={ladder.outputLabels}
						kind="output"
						onChange={ladder.setOutputLabels}
					/>
				</div>
				<LadderActions allDone={ladder.allDone} onReset={ladder.reset} onStartAll={ladder.startAll} />
			</div>
			<div className="mg-play-surface mg-play-surface-scroll space-y-3 min-w-0">
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
				<LadderResults
					anyDone={ladder.anyDone}
					inputLabels={ladder.inputLabels}
					inputs={ladder.inputs}
					inputStates={ladder.inputStates}
					outputLabels={ladder.outputLabels}
					results={ladder.results}
				/>
			</div>
		</div>
	);
}
