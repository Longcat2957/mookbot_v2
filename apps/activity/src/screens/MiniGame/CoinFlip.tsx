// 동전 던지기 — BLUE / RED 2면.
// 결과는 던지기 직전에 결정 → target rotation 으로 환산해 자연스러운 정지.
//
// 버그 수정 (v0.2.15):
//   - bob 효과는 outer wrapper 의 translateY only 로 분리. 내부 .mg-coin 의 inline rotateY 와 충돌 X.
//   - .mg-coin 의 transition: transform 은 styles.css 에서 항상-on. phase 별 toggle 안 함 →
//     첫 번째 변화에 transition 안 걸리는 CSS edge case 회피.

import { useState } from "react";

type Side = "BLUE" | "RED";
type Phase = "idle" | "flipping" | "settled";

const FLIPS_MIN = 5;
const FLIPS_MAX = 8;
const FLIP_DURATION_MS = 2400;

export function CoinFlip() {
	const [phase, setPhase] = useState<Phase>("idle");
	const [side, setSide] = useState<Side | null>(null);
	const [rotation, setRotation] = useState(0);

	function flip() {
		if (phase === "flipping") return;
		const result: Side = Math.random() < 0.5 ? "BLUE" : "RED";
		const flips = FLIPS_MIN + Math.floor(Math.random() * (FLIPS_MAX - FLIPS_MIN + 1));
		// 누적 회전: 매번 0~360 사이 보정값을 더해서 항상 앞으로만 회전 (역회전 X)
		const currentResidual = ((rotation % 360) + 360) % 360;
		const targetResidual = result === "RED" ? 180 : 0;
		const delta = flips * 360 + ((targetResidual - currentResidual + 360) % 360);

		setRotation((prev) => prev + delta);
		setSide(result);
		setPhase("flipping");
		window.setTimeout(() => setPhase("settled"), FLIP_DURATION_MS);
	}

	function reset() {
		setPhase("idle");
		setSide(null);
	}

	return (
		<div className="flex flex-col items-center justify-center py-6 gap-8">
			<div className="mg-coin-stage">
				{/* outer: bob (translateY only). inner: rotateY (inline). 분리해서 keyframe vs inline transform 충돌 회피. */}
				<div className={`mg-coin-bob ${phase === "idle" ? "mg-coin-bob-active" : ""}`}>
					<div className="mg-coin" style={{ transform: `rotateY(${rotation}deg)` }}>
						<div className="mg-coin-face mg-coin-face-blue">B</div>
						<div className="mg-coin-face mg-coin-face-red">R</div>
					</div>
				</div>
				<div className={`mg-coin-shadow ${phase === "flipping" ? "mg-coin-shadow-flipping" : ""}`} />
			</div>

			<div className="min-h-[3.5rem] flex items-center" aria-live="polite">
				{phase === "settled" && side && (
					<div
						className={`text-2xl sm:text-3xl font-bold ${side === "BLUE" ? "text-info" : "text-error"}`}
					>
						{side === "BLUE" ? "🟦 BLUE 진영" : "🟥 RED 진영"}
					</div>
				)}
				{phase === "flipping" && (
					<div className="text-base-content/50 text-sm tracking-wider">던지는 중…</div>
				)}
				{phase === "idle" && <div className="text-base-content/40 text-sm">버튼을 눌러 시작</div>}
			</div>

			<div className="flex gap-2">
				<button
					type="button"
					className="btn btn-primary btn-lg gap-2"
					onClick={flip}
					disabled={phase === "flipping"}
				>
					🪙 {phase === "settled" ? "다시 던지기" : "던지기"}
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
