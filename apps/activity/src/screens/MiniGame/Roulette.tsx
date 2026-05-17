import { useEffect, useMemo, useState } from "react";
import {
	defaultLabel,
	type Phase,
	SEGMENT_COLORS,
	SPIN_DURATION_MS,
} from "./Roulette/constants.js";
import { RouletteControls } from "./Roulette/RouletteControls.js";
import { RouletteResult } from "./Roulette/RouletteResult.js";
import { RouletteWheel } from "./Roulette/RouletteWheel.js";
import { buildConicGradient, nextSpinRotation, randomResult } from "./Roulette/rouletteLogic.js";

export function Roulette() {
	const [count, setCount] = useState(2);
	const [labels, setLabels] = useState<string[]>(() =>
		Array.from({ length: 2 }, (_, i) => defaultLabel(i, 2)),
	);
	const [phase, setPhase] = useState<Phase>("idle");
	const [rotation, setRotation] = useState(0);
	const [resultIdx, setResultIdx] = useState<number | null>(null);

	// count 변경 시 라벨 길이 동기화 + 이전 결과 클리어
	useEffect(() => {
		setLabels((prev) => Array.from({ length: count }, (_, i) => prev[i] ?? defaultLabel(i, count)));
		setResultIdx(null);
		setPhase("idle");
	}, [count]);

	const segmentSize = 360 / count;

	const conicGradient = useMemo(() => {
		return buildConicGradient(count, segmentSize);
	}, [count, segmentSize]);

	function spin() {
		if (phase === "spinning") return;
		const result = randomResult(count);
		setRotation(nextSpinRotation({ rotation, result, segmentSize }));
		setResultIdx(result);
		setPhase("spinning");
		window.setTimeout(() => setPhase("settled"), SPIN_DURATION_MS);
	}

	function reset() {
		setPhase("idle");
		setResultIdx(null);
	}

	const isLocked = phase === "spinning";

	return (
		<div className="mg-game-layout mg-game-layout-controls-right">
			<div className="mg-play-surface mg-roulette-play">
				<RouletteWheel
					labels={labels}
					segmentSize={segmentSize}
					conicGradient={conicGradient}
					rotation={rotation}
					phase={phase}
				/>
			</div>

			<div className="mg-control-panel min-w-0">
				<RouletteControls
					count={count}
					labels={labels}
					isLocked={isLocked}
					onCountChange={setCount}
					onLabelChange={(index, value) =>
						setLabels((prev) => prev.map((label, current) => (current === index ? value : label)))
					}
				/>
				<RouletteResult phase={phase} resultIdx={resultIdx} labels={labels} />

				<div className="mg-chip-grid">
					{labels.map((label, index) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: index is the stable roulette segment identity.
							key={`candidate-${index}`}
							className="flex items-center gap-2 rounded-md bg-base-100/60 border border-base-300 px-2 py-1.5 min-w-0"
						>
							<span
								className="size-2.5 rounded-full shrink-0"
								style={{ background: SEGMENT_COLORS[index % SEGMENT_COLORS.length] }}
								aria-hidden
							/>
							<span className="truncate text-xs font-medium">{label}</span>
						</div>
					))}
				</div>

				<div className="grid grid-cols-1 gap-2">
					<button type="button" className="btn btn-primary btn-lg" onClick={spin} disabled={isLocked}>
						{phase === "settled" ? "다시 돌리기" : "돌리기"}
					</button>
					{phase === "settled" && (
						<button type="button" className="btn btn-ghost btn-lg" onClick={reset}>
							초기화
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
