import type { CSSProperties } from "react";
import { LadderActions } from "./Ladder/LadderActions.js";
import { LadderControls } from "./Ladder/LadderControls.js";
import { LadderLabelGrid } from "./Ladder/LadderLabelGrid.js";
import { LadderResults } from "./Ladder/LadderResults.js";
import { LadderStage } from "./Ladder/LadderStage.js";
import { useLadderState } from "./Ladder/useLadderState.js";
import { MiniGameControls, MiniGameLayout, MiniGameSection, MiniGameStage } from "./shared.js";

export function Ladder() {
	const ladder = useLadderState();

	return (
		<MiniGameLayout controls="left">
			<MiniGameControls>
				<LadderControls
					count={ladder.count}
					isLocked={ladder.isLocked}
					onCountChange={ladder.setCount}
				/>
				<MiniGameSection title="입력">
					<LadderLabelGrid
						disabled={ladder.isLocked}
						items={ladder.inputs}
						labels={ladder.inputLabels}
						kind="input"
						onChange={ladder.setInputLabels}
					/>
				</MiniGameSection>
				<MiniGameSection title="출력">
					<LadderLabelGrid
						disabled={ladder.isLocked}
						items={ladder.outputs}
						labels={ladder.outputLabels}
						kind="output"
						onChange={ladder.setOutputLabels}
					/>
				</MiniGameSection>
				<LadderActions allDone={ladder.allDone} onReset={ladder.reset} onStartAll={ladder.startAll} />
			</MiniGameControls>
			<MiniGameStage scroll className="mg-ladder-play">
				<div
					className="mg-ladder-board space-y-3"
					style={{ "--mg-ladder-count": ladder.inputs.length } as CSSProperties}
				>
					<LadderStage
						geom={ladder.geom}
						inputLabels={ladder.inputLabels}
						inputs={ladder.inputs}
						inputStates={ladder.inputStates}
						outputLabels={ladder.outputLabels}
						outputs={ladder.outputs}
						pathsByInput={ladder.pathsByInput}
						rungDelays={ladder.rungDelays}
						rungs={ladder.rungs}
						rungsKey={ladder.rungsKey}
						onStartInput={ladder.startInput}
					/>
				</div>
				<LadderResults
					anyDone={ladder.anyDone}
					inputLabels={ladder.inputLabels}
					inputs={ladder.inputs}
					inputStates={ladder.inputStates}
					outputLabels={ladder.outputLabels}
					results={ladder.results}
				/>
			</MiniGameStage>
		</MiniGameLayout>
	);
}
