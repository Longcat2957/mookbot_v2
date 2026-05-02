// 사다리타기 — 네이버 사다리 스타일.
//
// 핵심:
//   - 상단 N 개 입력 버튼 (색깔 동그라미). 클릭하면 그 입력의 dot 가 경로 따라 내려감.
//   - 점 위치 보간은 CSS `offset-path: path("...")` + transition (offset-distance 0% → 100%).
//     JS rAF 없이 GPU 가속 보간. setTimeout 으로 done 시점 감지.
//   - trace 선은 stroke-dashoffset transition 으로 dot 와 동일 시간/easing 동기.
//   - "전체 결과 보기" 는 미시작 입력을 stagger (150ms) 로 동시 시작 — 시각적 풍부.

import { useEffect, useMemo, useRef, useState } from "react";

const MIN_COUNT = 2;
const MAX_COUNT = 10;
const ROWS = 10; // 가로단 수 (시각적 풍부함)
const RUNG_PROB = 0.55;
const ANIM_DURATION_MS = 1800;
const STAGGER_MS = 150;

type InputState = "idle" | "running" | "done";

interface Rung {
	row: number;
	col: number; // 기둥 col 과 col+1 사이
}

const TRACE_COLORS = [
	"#3b82f6", // blue
	"#ef4444", // red
	"#22c55e", // green
	"#f59e0b", // amber
	"#a855f7", // purple
	"#06b6d4", // cyan
	"#ec4899", // pink
	"#84cc16", // lime
	"#f97316", // orange
	"#14b8a6", // teal
];

function defaultInputLabel(i: number, count: number): string {
	if (count === 2) return i === 0 ? "1팀" : "2팀";
	return `${i + 1}번`;
}

function defaultOutputLabel(i: number, count: number): string {
	if (count === 2) return i === 0 ? "BLUE" : "RED";
	return `결과${i + 1}`;
}

function generateRungs(count: number): Rung[] {
	const rungs: Rung[] = [];
	for (let r = 0; r < ROWS; r++) {
		let prevPlaced = false;
		for (let c = 0; c < count - 1; c++) {
			if (prevPlaced) {
				prevPlaced = false;
				continue;
			}
			if (Math.random() < RUNG_PROB) {
				rungs.push({ row: r, col: c });
				prevPlaced = true;
			}
		}
	}
	return rungs;
}

function simulate(count: number, rungs: Rung[]): number[] {
	const set = new Set(rungs.map((r) => `${r.row}:${r.col}`));
	const results: number[] = [];
	for (let i = 0; i < count; i++) {
		let col = i;
		for (let r = 0; r < ROWS; r++) {
			if (set.has(`${r}:${col}`)) col += 1;
			else if (col > 0 && set.has(`${r}:${col - 1}`)) col -= 1;
		}
		results.push(col);
	}
	return results;
}

interface Geom {
	W: number;
	H: number;
	x: (i: number) => number;
	rowY: (r: number) => number;
	topY: number;
	bottomY: number;
}

function buildPath(startCol: number, rungs: Rung[], geom: Geom): string {
	const set = new Set(rungs.map((r) => `${r.row}:${r.col}`));
	let col = startCol;
	const parts: string[] = [`M ${geom.x(col)} ${geom.topY}`];
	for (let r = 0; r < ROWS; r++) {
		parts.push(`L ${geom.x(col)} ${geom.rowY(r)}`);
		if (set.has(`${r}:${col}`)) {
			parts.push(`L ${geom.x(col + 1)} ${geom.rowY(r)}`);
			col += 1;
		} else if (col > 0 && set.has(`${r}:${col - 1}`)) {
			parts.push(`L ${geom.x(col - 1)} ${geom.rowY(r)}`);
			col -= 1;
		}
	}
	parts.push(`L ${geom.x(col)} ${geom.bottomY}`);
	return parts.join(" ");
}

export function Ladder() {
	const [count, setCount] = useState(2);
	const [inputLabels, setInputLabels] = useState<string[]>(() =>
		Array.from({ length: 2 }, (_, i) => defaultInputLabel(i, 2)),
	);
	const [outputLabels, setOutputLabels] = useState<string[]>(() =>
		Array.from({ length: 2 }, (_, i) => defaultOutputLabel(i, 2)),
	);
	const [rungs, setRungs] = useState<Rung[]>(() => generateRungs(2));
	const [results, setResults] = useState<number[]>(() => simulate(2, rungs));
	const [inputStates, setInputStates] = useState<Record<number, InputState>>({});
	// rungsKey 변경 시 SVG 자식 elements 가 React key 로 unmount/mount → CSS transition 잔재 0.
	const [rungsKey, setRungsKey] = useState(0);
	// 진행 중 setTimeout 들을 reset 시 모두 취소
	const timersRef = useRef<number[]>([]);

	function clearTimers() {
		for (const id of timersRef.current) window.clearTimeout(id);
		timersRef.current = [];
	}

	// count 변경 시 rungs 재생성 + runners 클리어 + 라벨 길이 동기화
	useEffect(() => {
		clearTimers();
		const r = generateRungs(count);
		setRungs(r);
		setResults(simulate(count, r));
		setInputStates({});
		setRungsKey((k) => k + 1);
		setInputLabels((prev) =>
			Array.from({ length: count }, (_, i) => prev[i] ?? defaultInputLabel(i, count)),
		);
		setOutputLabels((prev) =>
			Array.from({ length: count }, (_, i) => prev[i] ?? defaultOutputLabel(i, count)),
		);
	}, [count]);

	useEffect(() => {
		return () => clearTimers();
	}, []);

	const geom = useMemo<Geom>(() => {
		const SPACING = 80;
		const PAD_X = 40;
		const W = PAD_X * 2 + Math.max(0, count - 1) * SPACING;
		const H = 360;
		const PAD_TOP = 50;
		const PAD_BOTTOM = 60;
		const topY = PAD_TOP;
		const bottomY = H - PAD_BOTTOM;
		const x = (i: number) => PAD_X + i * SPACING;
		const rowY = (r: number) => topY + ((r + 1) * (bottomY - topY)) / (ROWS + 1);
		return { W, H, x, topY, bottomY, rowY };
	}, [count]);

	function startInput(i: number) {
		if (inputStates[i] === "running" || inputStates[i] === "done") return;
		setInputStates((prev) => ({ ...prev, [i]: "running" }));
		const id = window.setTimeout(() => {
			setInputStates((prev) => ({ ...prev, [i]: "done" }));
		}, ANIM_DURATION_MS);
		timersRef.current.push(id);
	}

	function startAll() {
		const pending: number[] = [];
		for (let i = 0; i < count; i++) {
			if (inputStates[i] !== "running" && inputStates[i] !== "done") pending.push(i);
		}
		pending.forEach((i, idx) => {
			const startId = window.setTimeout(() => {
				setInputStates((prev) => ({ ...prev, [i]: "running" }));
				const doneId = window.setTimeout(() => {
					setInputStates((prev) => ({ ...prev, [i]: "done" }));
				}, ANIM_DURATION_MS);
				timersRef.current.push(doneId);
			}, idx * STAGGER_MS);
			timersRef.current.push(startId);
		});
	}

	function reset() {
		clearTimers();
		const r = generateRungs(count);
		setRungs(r);
		setResults(simulate(count, r));
		setInputStates({});
		setRungsKey((k) => k + 1);
	}

	const inputs = Array.from({ length: count }, (_, i) => i);
	const outputs = Array.from({ length: count }, (_, i) => i);
	const isLocked = Object.values(inputStates).some((s) => s === "running" || s === "done");
	const allDone = inputs.every((i) => inputStates[i] === "done");
	const anyDone = Object.values(inputStates).some((s) => s === "done");

	return (
		<div className="flex flex-col gap-3 py-2">
			{/* 인원 슬라이더 */}
			<div className="flex items-center gap-3 flex-wrap">
				<label className="text-sm font-medium" htmlFor="ladder-count">
					인원
				</label>
				<input
					id="ladder-count"
					type="range"
					min={MIN_COUNT}
					max={MAX_COUNT}
					value={count}
					onChange={(e) => setCount(Number(e.target.value))}
					disabled={isLocked}
					className="range range-sm range-primary max-w-xs flex-1 min-w-32"
				/>
				<span className="badge badge-neutral tabular-nums">{count}명</span>
			</div>

			{/* 입력 라벨 (편집) */}
			<div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
				{inputs.map((i) => (
					<input
						key={`in-${i}`}
						type="text"
						value={inputLabels[i] ?? ""}
						onChange={(e) => setInputLabels((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
						disabled={isLocked}
						maxLength={8}
						className="input input-xs input-bordered text-center"
						aria-label={`입력 ${i + 1} 라벨`}
						style={{ borderLeft: `4px solid ${TRACE_COLORS[i % TRACE_COLORS.length]}` }}
					/>
				))}
			</div>

			<div className="text-xs text-base-content/60 text-center">
				↓ 위쪽 색깔 동그라미를 눌러 한 명씩 사다리 결과 확인
			</div>

			{/* SVG 사다리 */}
			<div className="mg-ladder-stage">
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

					{/* 기둥 */}
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

					{/* 가로대 */}
					{rungs.map((r, idx) => (
						<line
							key={`rung-${rungsKey}-${idx}`}
							className="mg-ladder-rung"
							x1={geom.x(r.col)}
							y1={geom.rowY(r.row)}
							x2={geom.x(r.col + 1)}
							y2={geom.rowY(r.row)}
						/>
					))}

					{/* 추적선 — class active 토글로 stroke-dashoffset transition */}
					{inputs.map((i) => {
						const state = inputStates[i] ?? "idle";
						const active = state === "running" || state === "done";
						const pathD = buildPath(i, rungs, geom);
						return (
							<path
								key={`trace-${rungsKey}-${i}`}
								d={pathD}
								pathLength={100}
								className={`mg-ladder-trace ${active ? "active" : ""}`}
								style={{ stroke: TRACE_COLORS[i % TRACE_COLORS.length] }}
							/>
						);
					})}

					{/* 출력 핀 */}
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

					{/* 입력 버튼 (top circles) */}
					{inputs.map((i) => {
						const state = inputStates[i] ?? "idle";
						const color = TRACE_COLORS[i % TRACE_COLORS.length];
						return (
							<g
								key={`btn-${rungsKey}-${i}`}
								className="mg-ladder-input-btn"
								data-state={state}
								onClick={() => startInput(i)}
							>
								<circle cx={geom.x(i)} cy={geom.topY - 22} r={15} fill={color} />
								<text x={geom.x(i)} y={geom.topY - 22} className="mg-ladder-input-btn-text">
									{i + 1}
								</text>
							</g>
						);
					})}

					{/* 이동 dot — offset-path 인라인 + class active 토글로 offset-distance transition */}
					{inputs.map((i) => {
						const state = inputStates[i] ?? "idle";
						const active = state === "running" || state === "done";
						const pathD = buildPath(i, rungs, geom);
						const color = TRACE_COLORS[i % TRACE_COLORS.length];
						return (
							<circle
								key={`dot-${rungsKey}-${i}`}
								cx={0}
								cy={0}
								r={9}
								fill={color}
								className={`mg-ladder-dot ${active ? "active" : ""}`}
								style={
									{
										offsetPath: `path("${pathD}")`,
										color, // drop-shadow currentColor 용
									} as React.CSSProperties
								}
							/>
						);
					})}
				</svg>
			</div>

			{/* 출력 라벨 */}
			<div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
				{outputs.map((i) => (
					<input
						key={`out-${i}`}
						type="text"
						value={outputLabels[i] ?? ""}
						onChange={(e) =>
							setOutputLabels((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
						}
						disabled={isLocked}
						maxLength={8}
						className="input input-xs input-bordered text-center font-semibold"
						aria-label={`출력 ${i + 1} 라벨`}
					/>
				))}
			</div>

			{/* 결과 매핑 (done 된 것만) */}
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

			{/* 액션 */}
			<div className="flex justify-center gap-2 flex-wrap">
				<button
					type="button"
					className="btn btn-primary btn-lg gap-2"
					onClick={startAll}
					disabled={allDone}
				>
					🪜 전체 결과 보기
				</button>
				<button type="button" className="btn btn-ghost btn-lg" onClick={reset}>
					재시작
				</button>
			</div>
		</div>
	);
}
