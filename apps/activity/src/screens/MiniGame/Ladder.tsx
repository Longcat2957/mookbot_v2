// 사다리타기 — N 명 (2~6) 입력 → N 개 출력 random 매핑.
// SVG path 의 pathLength=100 정규화 + stroke-dashoffset 애니메이션으로 추적선.

import { useEffect, useMemo, useState } from "react";

const MIN_COUNT = 2;
const MAX_COUNT = 6;
const ROWS = 9; // 시각적 풍부함을 위한 가로 단 수
const RUNG_PROB = 0.5;

interface Rung {
	row: number;
	col: number; // 기둥 col 과 col+1 사이의 가로대
}

type Phase = "idle" | "running" | "done";

const TRACE_COLORS = [
	"var(--color-info)",
	"var(--color-error)",
	"var(--color-success)",
	"var(--color-warning)",
	"var(--color-secondary)",
	"var(--color-primary)",
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

function buildPath(
	startCol: number,
	rungs: Rung[],
	geom: { x: (i: number) => number; rowY: (r: number) => number; topY: number; bottomY: number },
): string {
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
	const [phase, setPhase] = useState<Phase>("idle");
	const [rungs, setRungs] = useState<Rung[] | null>(null);
	const [results, setResults] = useState<number[] | null>(null);

	// count 변경 시 라벨 배열 길이 동기화 (기본값 자동 채움)
	useEffect(() => {
		setInputLabels((prev) =>
			Array.from({ length: count }, (_, i) => prev[i] ?? defaultInputLabel(i, count)),
		);
		setOutputLabels((prev) =>
			Array.from({ length: count }, (_, i) => prev[i] ?? defaultOutputLabel(i, count)),
		);
	}, [count]);

	const geom = useMemo(() => {
		const W = 100 + (count - 1) * 110;
		const H = 360;
		const PAD_X = 40;
		const PAD_TOP = 30;
		const PAD_BOTTOM = 30;
		const topY = PAD_TOP;
		const bottomY = H - PAD_BOTTOM;
		const x = (i: number) => PAD_X + (i * (W - 2 * PAD_X)) / Math.max(count - 1, 1);
		const rowY = (r: number) => topY + ((r + 1) * (bottomY - topY)) / (ROWS + 1);
		return { W, H, x, topY, bottomY, rowY };
	}, [count]);

	function start() {
		if (phase === "running") return;
		const r = generateRungs(count);
		const res = simulate(count, r);
		setRungs(r);
		setResults(res);
		setPhase("running");
		// CSS transition 1.6s 와 일치 (styles.css)
		window.setTimeout(() => setPhase("done"), 1700);
	}

	function reset() {
		setRungs(null);
		setResults(null);
		setPhase("idle");
	}

	const inputs = Array.from({ length: count }, (_, i) => i);
	const outputs = Array.from({ length: count }, (_, i) => i);
	const inputsLocked = phase !== "idle";

	return (
		<div className="flex flex-col gap-4 py-2">
			{/* 인원 수 슬라이더 — idle 일 때만 활성 */}
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
					disabled={inputsLocked}
					className="range range-sm range-primary max-w-xs flex-1 min-w-32"
				/>
				<span className="badge badge-neutral tabular-nums">{count}명</span>
			</div>

			{/* 입력 라벨 */}
			<div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
				{inputs.map((i) => (
					<input
						key={`in-${i}`}
						type="text"
						value={inputLabels[i] ?? ""}
						onChange={(e) => setInputLabels((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
						disabled={inputsLocked}
						maxLength={8}
						className="input input-sm input-bordered text-center"
						aria-label={`입력 ${i + 1} 라벨`}
					/>
				))}
			</div>

			{/* SVG 사다리 */}
			<div className="mg-ladder-stage overflow-x-auto">
				<svg
					viewBox={`0 0 ${geom.W} ${geom.H}`}
					width={geom.W}
					height={geom.H}
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

					{/* 위쪽 캡 (입력 chip) */}
					{inputs.map((i) => (
						<rect
							key={`cap-top-${i}`}
							className="mg-ladder-cap"
							x={geom.x(i) - 18}
							y={geom.topY - 14}
							width={36}
							height={14}
							rx={3}
						/>
					))}

					{/* 기둥 */}
					{inputs.map((i) => (
						<line
							key={`post-${i}`}
							className="mg-ladder-post"
							x1={geom.x(i)}
							y1={geom.topY}
							x2={geom.x(i)}
							y2={geom.bottomY}
						/>
					))}

					{/* 가로대 (rungs) — rungs 가 생성된 후에만 표시 */}
					{rungs?.map((r, idx) => (
						<line
							// biome-ignore lint/suspicious/noArrayIndexKey: rungs 배열은 한 번 생성되면 변하지 않음
							key={`rung-${idx}`}
							className="mg-ladder-rung"
							x1={geom.x(r.col)}
							y1={geom.rowY(r.row)}
							x2={geom.x(r.col + 1)}
							y2={geom.rowY(r.row)}
						/>
					))}

					{/* 추적선 */}
					{rungs &&
						inputs.map((i) => (
							<path
								key={`trace-${i}`}
								className={`mg-ladder-trace ${phase !== "idle" ? "mg-ladder-trace-running" : ""}`}
								d={buildPath(i, rungs, geom)}
								pathLength={100}
								style={
									{
										"--mg-trace-len": "100",
										stroke: TRACE_COLORS[i % TRACE_COLORS.length],
										strokeDasharray: 100,
										strokeDashoffset: phase === "idle" ? 100 : 0,
										transitionDelay: `${i * 80}ms`,
									} as React.CSSProperties
								}
							/>
						))}

					{/* 아래 출력 핀 */}
					{outputs.map((i) => (
						<circle
							key={`out-pin-${i}`}
							className="mg-ladder-output-pin"
							cx={geom.x(i)}
							cy={geom.bottomY + 10}
							r={6}
							fill={TRACE_COLORS[i % TRACE_COLORS.length]}
						/>
					))}
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
						disabled={inputsLocked}
						maxLength={8}
						className="input input-sm input-bordered text-center font-semibold"
						aria-label={`출력 ${i + 1} 라벨`}
					/>
				))}
			</div>

			{/* 결과 */}
			<div className="min-h-[3rem]" aria-live="polite">
				{phase === "done" && results && (
					<div className="rounded-lg border border-base-300 bg-base-100 p-3">
						<div className="text-xs text-base-content/60 mb-2 font-semibold">결과 매핑</div>
						<div className="flex flex-col gap-1 text-sm">
							{inputs.map((i) => {
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
				{phase === "running" && (
					<div className="text-base-content/50 text-sm text-center">사다리 추적 중…</div>
				)}
			</div>

			{/* 액션 */}
			<div className="flex justify-center gap-2">
				<button
					type="button"
					className="btn btn-primary btn-lg gap-2"
					onClick={start}
					disabled={phase === "running"}
				>
					🪜 {phase === "done" ? "다시 돌리기" : "시작"}
				</button>
				{phase === "done" && (
					<button type="button" className="btn btn-ghost btn-lg" onClick={reset}>
						초기화
					</button>
				)}
			</div>
		</div>
	);
}
