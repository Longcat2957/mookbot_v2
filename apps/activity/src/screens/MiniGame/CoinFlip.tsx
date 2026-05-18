// 동전 던지기 — BLUE / RED 2면.
// 동전은 랜덤 난류 회전 → 결과 착지의 2단계로 움직인다.
// 결과 텍스트는 착지 완료 후에만 공개한다.

import { useEffect, useRef, useState } from "react";
import {
	MiniGameActionBar,
	MiniGameControls,
	MiniGameLayout,
	MiniGameStage,
	MiniGameStatusCard,
} from "./shared.js";

type Side = "BLUE" | "RED";
type Phase = "idle" | "flipping" | "settling" | "settled";

const CHAOS_DURATION_MS = 900;
const SETTLE_DURATION_MS = 1500;
const FLIP_DURATION_MS = CHAOS_DURATION_MS + SETTLE_DURATION_MS;

function randomInt(min: number, max: number) {
	return min + Math.floor(Math.random() * (max - min + 1));
}

function normalizedDegrees(value: number) {
	return ((value % 360) + 360) % 360;
}

export function CoinFlip() {
	const [phase, setPhase] = useState<Phase>("idle");
	const [side, setSide] = useState<Side | null>(null);
	const [rotation, setRotation] = useState(0);
	const timersRef = useRef<number[]>([]);

	const isBusy = phase === "flipping" || phase === "settling";

	function clearTimers() {
		for (const id of timersRef.current) window.clearTimeout(id);
		timersRef.current = [];
	}

	useEffect(() => {
		return () => {
			for (const id of timersRef.current) window.clearTimeout(id);
			timersRef.current = [];
		};
	}, []);

	function flip() {
		if (isBusy) return;
		const result: Side = Math.random() < 0.5 ? "BLUE" : "RED";
		const chaosResidual = 35 + Math.random() * 290;
		const currentResidual = normalizedDegrees(rotation);
		const chaosDelta = randomInt(3, 5) * 360 + normalizedDegrees(chaosResidual - currentResidual);

		clearTimers();
		setSide(null);
		setRotation((prev) => prev + chaosDelta);
		setPhase("flipping");

		timersRef.current.push(
			window.setTimeout(() => {
				setPhase("settling");
				setRotation((prev) => {
					const targetResidual = result === "RED" ? 180 : 0;
					const residual = normalizedDegrees(prev);
					return prev + randomInt(2, 4) * 360 + normalizedDegrees(targetResidual - residual);
				});
			}, CHAOS_DURATION_MS),
			window.setTimeout(() => {
				setSide(result);
				setPhase("settled");
			}, FLIP_DURATION_MS),
		);
	}

	function reset() {
		clearTimers();
		setPhase("idle");
		setSide(null);
	}

	return (
		<MiniGameLayout controls="right">
			<MiniGameStage className="mg-coin-play">
				<div className="mg-coin-arena">
					<div className="mg-coin-side-pill mg-coin-side-blue">
						<span>BLUE</span>
						<strong>B</strong>
					</div>
					<div
						className={`mg-coin-stage ${isBusy ? "mg-coin-stage-flipping" : ""} ${phase === "settled" ? "mg-coin-stage-settled" : ""}`}
					>
						{/* outer: bob (translateY only). inner: rotateY (inline). 분리해서 keyframe vs inline transform 충돌 회피. */}
						<div
							className={`mg-coin-bob ${phase === "idle" ? "mg-coin-bob-active" : ""} ${phase === "flipping" ? "mg-coin-bob-toss" : ""} ${phase === "settling" ? "mg-coin-bob-settle" : ""}`}
						>
							<div
								className={`mg-coin ${phase === "flipping" ? "mg-coin-flipping" : ""} ${phase === "settling" ? "mg-coin-settling" : ""}`}
								style={{ transform: `rotateY(${rotation}deg)` }}
							>
								<div className="mg-coin-face mg-coin-face-blue">
									<span className="mg-coin-mark">B</span>
								</div>
								<div className="mg-coin-face mg-coin-face-red">
									<span className="mg-coin-mark">R</span>
								</div>
							</div>
						</div>
						<div className={`mg-coin-shadow ${isBusy ? "mg-coin-shadow-flipping" : ""}`} />
					</div>
					<div className="mg-coin-side-pill mg-coin-side-red">
						<span>RED</span>
						<strong>R</strong>
					</div>
				</div>
			</MiniGameStage>

			<MiniGameControls>
				{phase === "settled" && side && (
					<MiniGameStatusCard className={side === "BLUE" ? "mg-result-blue" : "mg-result-red"}>
						<div className="mg-coin-result">
							<span>{side}</span>
						</div>
					</MiniGameStatusCard>
				)}

				<MiniGameActionBar>
					<button type="button" className="btn btn-primary btn-lg" onClick={flip} disabled={isBusy}>
						{phase === "settled" ? "다시 던지기" : "던지기"}
					</button>
					{phase === "settled" && (
						<button type="button" className="btn btn-ghost btn-lg" onClick={reset}>
							초기화
						</button>
					)}
				</MiniGameActionBar>
			</MiniGameControls>
		</MiniGameLayout>
	);
}
