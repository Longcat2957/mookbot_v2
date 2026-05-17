import { LadderActions } from "./Ladder/LadderActions.js";
import { LadderControls } from "./Ladder/LadderControls.js";
import { LadderLabelGrid } from "./Ladder/LadderLabelGrid.js";
import { LadderResults } from "./Ladder/LadderResults.js";
import { LadderStage } from "./Ladder/LadderStage.js";
import { useLadderState } from "./Ladder/useLadderState.js";
import type { CSSProperties } from "react";

export function Ladder() {
	const ladder = useLadderState();

	return (
		<div className="mg-game-layout mg-game-layout-controls-left">
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
				<LadderActions allDone={ladder.allDone} onReset={ladder.reset} onStartAll={ladder.startAll} />
			</div>
			<div className="mg-play-surface mg-play-surface-scroll space-y-3 min-w-0">
				<div
					className="mg-ladder-board space-y-3"
					style={{ "--mg-ladder-count": ladder.inputs.length } as CSSProperties}
				>
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
					<div className="space-y-2">
						<div className="text-xs font-semibold text-base-content/60">출력</div>
						<LadderLabelGrid
							disabled={ladder.isLocked}
							items={ladder.outputs}
							labels={ladder.outputLabels}
							kind="output"
							alignColumns
							onChange={ladder.setOutputLabels}
						/>
					</div>
				</div>
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
