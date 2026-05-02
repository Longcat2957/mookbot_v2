// 동전 던지기 — BLUE / RED 2면.
// 결과는 던지기 직전에 결정 → target rotation 으로 환산해 자연스러운 정지.

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
		// rotation 은 유지 — 다음 flip 도 자연스럽게 이어짐
	}

	const transition =
		phase === "flipping" ? `transform ${FLIP_DURATION_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)` : "none";

	return (
		<div className="flex flex-col items-center justify-center py-6 gap-8">
			<div className="mg-coin-stage">
				<div
					className={`mg-coin ${phase === "idle" ? "mg-coin-idle" : ""}`}
					style={{ transform: `rotateY(${rotation}deg)`, transition }}
				>
					<div className="mg-coin-face mg-coin-face-blue">B</div>
					<div className="mg-coin-face mg-coin-face-red">R</div>
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
