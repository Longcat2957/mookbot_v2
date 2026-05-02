// 원판 돌리기 — 2~8 segment.
//
// 디스크 = conic-gradient. 회전 = `transform: rotate(R)` + 4초 ease-out transition.
// 12시 ▼ 포인터가 가리키는 segment 가 결과.
//
// 결과 R 계산: pointer 는 world 0deg (12시). segment k 의 center = (k + 0.5) × segmentSize.
// 회전 R 후 segment k center 의 world 각도 = R + (k + 0.5) × segmentSize. 이게 0 (= 12시) 이려면:
//   R = -((k + 0.5) × segmentSize) mod 360
// + 시각적으로 여러 바퀴 회전: R_total = N × 360 + (target - currentResidual) (mod 360).

import { useEffect, useMemo, useState } from "react";

const MIN_COUNT = 2;
const MAX_COUNT = 8;
const SPIN_DURATION_MS = 4000;
const SPINS_MIN = 4;
const SPINS_MAX = 7;

const SEGMENT_COLORS = [
	"#3b82f6", // blue
	"#ef4444", // red
	"#22c55e", // green
	"#f59e0b", // amber
	"#a855f7", // purple
	"#06b6d4", // cyan
	"#ec4899", // pink
	"#84cc16", // lime
];

type Phase = "idle" | "spinning" | "settled";

function defaultLabel(i: number, count: number): string {
	if (count === 2) return i === 0 ? "BLUE" : "RED";
	return `${i + 1}`;
}

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
		const stops: string[] = [];
		for (let i = 0; i < count; i++) {
			const start = i * segmentSize;
			const end = (i + 1) * segmentSize;
			const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
			stops.push(`${color} ${start}deg ${end}deg`);
		}
		return `conic-gradient(from 0deg, ${stops.join(", ")})`;
	}, [count, segmentSize]);

	function spin() {
		if (phase === "spinning") return;
		const result = Math.floor(Math.random() * count);
		const fullSpins = SPINS_MIN + Math.floor(Math.random() * (SPINS_MAX - SPINS_MIN + 1));
		// pointer 는 12시 (0deg). segment k center 가 0deg 에 와야 함.
		// segment k center = (k + 0.5) × segmentSize (시계방향). R = -center mod 360.
		const targetResidual = (360 - (result + 0.5) * segmentSize + 720) % 360;
		const currentResidual = ((rotation % 360) + 360) % 360;
		const delta = fullSpins * 360 + ((targetResidual - currentResidual + 360) % 360);

		setRotation((prev) => prev + delta);
		setResultIdx(result);
		setPhase("spinning");
		window.setTimeout(() => setPhase("settled"), SPIN_DURATION_MS);
	}

	function reset() {
		setPhase("idle");
		setResultIdx(null);
	}

	const isLocked = phase === "spinning";
	const labelRadius = 110; // px from center, depends on stage size — clamp(120, 30vw, 180) → 라벨은 그 60% 정도
	// (실제 stage 크기는 clamp 이지만 라벨은 viewport 기반 px 사용으로 충분히 잘 위치)

	return (
		<div className="flex flex-col items-center gap-4 py-2">
			{/* 인원 슬라이더 */}
			<div className="flex items-center gap-3 flex-wrap self-stretch">
				<label className="text-sm font-medium" htmlFor="roulette-count">
					인원
				</label>
				<input
					id="roulette-count"
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

			{/* 라벨 편집 */}
			<div
				className="grid gap-1 self-stretch"
				style={{
					gridTemplateColumns: `repeat(${Math.min(count, 4)}, minmax(0, 1fr))`,
				}}
			>
				{labels.map((lab, i) => (
					<input
						key={`lab-${i}`}
						type="text"
						value={lab}
						onChange={(e) => setLabels((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
						disabled={isLocked}
						maxLength={10}
						className="input input-xs input-bordered text-center"
						aria-label={`섹션 ${i + 1} 라벨`}
						style={{ borderLeft: `4px solid ${SEGMENT_COLORS[i % SEGMENT_COLORS.length]}` }}
					/>
				))}
			</div>

			{/* 원판 */}
			<div className="mg-roulette-stage">
				<div className="mg-roulette-pointer" aria-hidden />
				<div
					className="mg-roulette"
					style={{
						background: conicGradient,
						transform: `rotate(${rotation}deg)`,
					}}
				>
					{labels.map((lab, i) => {
						const angle = (i + 0.5) * segmentSize;
						return (
							<div
								key={`label-${i}`}
								className="mg-roulette-label"
								style={{
									transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-${labelRadius}px)`,
								}}
							>
								<span style={{ display: "inline-block", transform: `rotate(${-angle}deg)` }}>{lab}</span>
							</div>
						);
					})}
					<div className="mg-roulette-hub" />
				</div>
			</div>

			{/* 결과 */}
			<div className="min-h-[3rem]" aria-live="polite">
				{phase === "settled" && resultIdx !== null && (
					<div
						className="text-2xl sm:text-3xl font-bold"
						style={{ color: SEGMENT_COLORS[resultIdx % SEGMENT_COLORS.length] }}
					>
						🎯 {labels[resultIdx]}
					</div>
				)}
				{phase === "spinning" && <div className="text-base-content/50 text-sm">돌리는 중…</div>}
				{phase === "idle" && <div className="text-base-content/40 text-sm">버튼을 눌러 시작</div>}
			</div>

			<div className="flex gap-2">
				<button
					type="button"
					className="btn btn-primary btn-lg gap-2"
					onClick={spin}
					disabled={isLocked}
				>
					🎡 {phase === "settled" ? "다시 돌리기" : "돌리기"}
				</button>
				{phase === "settled" && (
					<button type="button" className="btn btn-ghost btn-lg" onClick={reset}>
						초기화
					</button>
				)}
			</div>
		</div>
	);
}
