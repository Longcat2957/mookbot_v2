import { type CSSProperties, type KeyboardEvent, useEffect, useMemo, useRef } from "react";
import { ANIM_DURATION_MS, TRACE_COLORS } from "./constants.js";
import {
	buildPathPoints,
	type Geom,
	type InputState,
	type Point,
	pointAtProgress,
	type Rung,
} from "./ladderLogic.js";

export function LadderStage({
	geom,
	inputLabels,
	inputs,
	inputStates,
	outputLabels,
	outputs,
	pathsByInput,
	rungDelays,
	rungs,
	rungsKey,
	onStartInput,
}: {
	geom: Geom;
	inputLabels: string[];
	inputs: number[];
	inputStates: Record<number, InputState>;
	outputLabels: string[];
	outputs: number[];
	pathsByInput: Map<number, string>;
	rungDelays: Map<number, number>;
	rungs: Rung[];
	rungsKey: number;
	onStartInput: (index: number) => void;
}) {
	const dotRefs = useRef(new Map<number, SVGCircleElement>());
	const activeAnimations = useRef(new Map<number, { startedAt: number; points: Point[] }>());
	const frameRef = useRef<number | null>(null);

	const pathPointsByInput = useMemo(() => {
		const map = new Map<number, Point[]>();
		for (const i of inputs) map.set(i, buildPathPoints(i, rungs, geom));
		return map;
	}, [geom, inputs, rungs]);

	useEffect(() => {
		activeAnimations.current.clear();
		if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
		frameRef.current = null;
		for (const [i, element] of dotRefs.current) {
			const point = pathPointsByInput.get(i)?.[0] ?? { x: 0, y: 0 };
			element.setAttribute("transform", `translate(${point.x} ${point.y})`);
		}
	}, [pathPointsByInput]);

	useEffect(() => {
		const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
		const now = performance.now();

		for (const i of inputs) {
			const state = inputStates[i] ?? "idle";
			const points = pathPointsByInput.get(i) ?? [{ x: 0, y: 0 }];
			const element = dotRefs.current.get(i);
			if (!element) continue;

			if (state === "idle") {
				activeAnimations.current.delete(i);
				const start = points[0] ?? { x: 0, y: 0 };
				element.setAttribute("transform", `translate(${start.x} ${start.y})`);
				continue;
			}

			if (state === "done") {
				activeAnimations.current.delete(i);
				const end = points.at(-1) ?? points[0] ?? { x: 0, y: 0 };
				element.setAttribute("transform", `translate(${end.x} ${end.y})`);
				continue;
			}

			if (!activeAnimations.current.has(i)) {
				activeAnimations.current.set(i, { startedAt: now, points });
			}
		}

		if (frameRef.current !== null) return;

		const tick = (time: number) => {
			for (const [i, animation] of activeAnimations.current) {
				const element = dotRefs.current.get(i);
				if (!element) {
					activeAnimations.current.delete(i);
					continue;
				}
				const progress = Math.min(1, (time - animation.startedAt) / ANIM_DURATION_MS);
				const point = pointAtProgress(animation.points, ease(progress));
				element.setAttribute("transform", `translate(${point.x} ${point.y})`);
				if (progress >= 1) activeAnimations.current.delete(i);
			}

			if (activeAnimations.current.size > 0) {
				frameRef.current = window.requestAnimationFrame(tick);
			} else {
				frameRef.current = null;
			}
		};

		frameRef.current = window.requestAnimationFrame(tick);

		return () => {
			if (frameRef.current !== null) {
				window.cancelAnimationFrame(frameRef.current);
				frameRef.current = null;
			}
		};
	}, [inputStates, inputs, pathPointsByInput]);

	function onKeyDown(e: KeyboardEvent<SVGGElement>, i: number, disabled: boolean) {
		if (disabled) return;
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			onStartInput(i);
		}
	}

	return (
		<div className="mg-ladder-stage">
			<div className="mg-ladder-label-row mg-ladder-label-row-top">
				{inputs.map((i) => (
					<div
						key={`top-label-${i}`}
						className="mg-ladder-label-chip"
						style={{ left: `${(geom.x(i) / geom.W) * 100}%` }}
					>
						<span>{inputLabels[i] ?? i + 1}</span>
					</div>
				))}
			</div>
			<svg
				viewBox={`0 0 ${geom.W} ${geom.H + 30}`}
				width={geom.W}
				height={geom.H + 30}
				className="mg-ladder"
				aria-label="사다리타기 시각화"
			>
				<title>사다리타기</title>
				<defs>
					<linearGradient id="mg-post-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
						<stop
							offset="0%"
							stopColor="color-mix(in oklch, var(--color-base-content), transparent 70%)"
						/>
						<stop offset="50%" stopColor="var(--color-base-content)" />
						<stop
							offset="100%"
							stopColor="color-mix(in oklch, var(--color-base-content), transparent 70%)"
						/>
					</linearGradient>
				</defs>

				{inputs.map((i) => (
					<line
						key={`post-${rungsKey}-${i}`}
						className="mg-ladder-post"
						x1={geom.x(i)}
						y1={geom.topY}
						x2={geom.x(i)}
						y2={geom.bottomY}
					/>
				))}

				{rungs.map((rung, idx) => {
					const delay = rungDelays.get(idx);
					const revealed = delay !== undefined;
					return (
						<line
							key={`rung-${rungsKey}-${rung.row}-${rung.col}`}
							className={`mg-ladder-rung ${revealed ? "revealed" : ""}`}
							x1={geom.x(rung.col)}
							y1={geom.rowY(rung.row)}
							x2={geom.x(rung.col + 1)}
							y2={geom.rowY(rung.row)}
							style={revealed ? { transitionDelay: `${delay}ms` } : undefined}
						/>
					);
				})}

				{inputs.map((i) => {
					const state = inputStates[i] ?? "idle";
					const active = state === "running" || state === "done";
					return (
						<path
							key={`trace-${rungsKey}-${i}`}
							d={pathsByInput.get(i) ?? ""}
							pathLength={100}
							className={`mg-ladder-trace ${active ? "active" : ""}`}
							style={{ stroke: TRACE_COLORS[i % TRACE_COLORS.length] }}
						/>
					);
				})}

				{outputs.map((i) => (
					<circle
						key={`out-pin-${rungsKey}-${i}`}
						className="mg-ladder-output-pin"
						cx={geom.x(i)}
						cy={geom.bottomY + 14}
						r={7}
						fill="var(--color-base-300)"
					/>
				))}

				{inputs.map((i) => {
					const state = inputStates[i] ?? "idle";
					const color = TRACE_COLORS[i % TRACE_COLORS.length];
					const disabled = state !== "idle";
					return (
						// biome-ignore lint/a11y/useSemanticElements: SVG groups cannot be replaced with HTML buttons.
						<g
							key={`btn-${rungsKey}-${i}`}
							className="mg-ladder-input-btn"
							data-state={state}
							role="button"
							tabIndex={disabled ? -1 : 0}
							aria-label={`사다리 입력 ${inputLabels[i] ?? i + 1}${disabled ? ` (${state === "running" ? "진행 중" : "완료"})` : " — 결과 보기"}`}
							aria-disabled={disabled}
							onClick={() => !disabled && onStartInput(i)}
							onKeyDown={(e) => onKeyDown(e, i, disabled)}
						>
							<circle
								className="mg-ladder-input-node"
								cx={geom.x(i)}
								cy={geom.topY - 22}
								r={17}
								fill={color}
							/>
							<text x={geom.x(i)} y={geom.topY - 22} className="mg-ladder-input-btn-text">
								{i + 1}
							</text>
						</g>
					);
				})}

				{inputs.map((i) => {
					const state = inputStates[i] ?? "idle";
					const active = state === "running" || state === "done";
					const color = TRACE_COLORS[i % TRACE_COLORS.length];
					return (
						<circle
							key={`dot-${rungsKey}-${i}`}
							ref={(element) => {
								if (element) dotRefs.current.set(i, element);
								else dotRefs.current.delete(i);
							}}
							cx={0}
							cy={0}
							r={10}
							fill={color}
							className={`mg-ladder-dot ${active ? "active" : ""}`}
							style={{ color } as CSSProperties}
						/>
					);
				})}
			</svg>
			<div className="mg-ladder-label-row mg-ladder-label-row-bottom">
				{outputs.map((i) => (
					<div
						key={`bottom-label-${i}`}
						className="mg-ladder-label-chip mg-ladder-output-label-chip"
						style={{ left: `${(geom.x(i) / geom.W) * 100}%` }}
					>
						<span>{outputLabels[i] ?? i + 1}</span>
					</div>
				))}
			</div>
		</div>
	);
}
