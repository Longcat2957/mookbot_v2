// 동전 던지기 — BLUE / RED 2면.
// 동전은 랜덤 난류 회전 → 결과 착지의 2단계로 움직인다.
// 결과 텍스트는 착지 완료 후에만 공개한다.

import { useEffect, useRef, useState } from "react";
import { cancelAnimation, prefersReducedMotion, startElementAnimation } from "./motion.js";
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
	const coinRef = useRef<HTMLDivElement | null>(null);
	const bobRef = useRef<HTMLDivElement | null>(null);
	const coinAnimationRef = useRef<Animation | null>(null);
	const bobAnimationRef = useRef<Animation | null>(null);

	const isBusy = phase === "flipping" || phase === "settling";

	function cancelRunningAnimations() {
		cancelAnimation(coinAnimationRef.current);
		cancelAnimation(bobAnimationRef.current);
	}

	useEffect(() => {
		return () => {
			cancelAnimation(coinAnimationRef.current);
			cancelAnimation(bobAnimationRef.current);
		};
	}, []);

	function flip() {
		if (isBusy) return;
		const result: Side = Math.random() < 0.5 ? "BLUE" : "RED";
		const chaosResidual = 35 + Math.random() * 290;
		const currentResidual = normalizedDegrees(rotation);
		const chaosDelta = randomInt(3, 5) * 360 + normalizedDegrees(chaosResidual - currentResidual);
		const chaosRotation = rotation + chaosDelta;
		const targetResidual = result === "RED" ? 180 : 0;
		const finalRotation =
			chaosRotation +
			randomInt(2, 4) * 360 +
			normalizedDegrees(targetResidual - normalizedDegrees(chaosRotation));
		const duration = prefersReducedMotion() ? 1 : FLIP_DURATION_MS;
		const chaosOffset = CHAOS_DURATION_MS / FLIP_DURATION_MS;

		cancelRunningAnimations();
		setSide(null);
		setPhase("flipping");

		const coinAnimation = startElementAnimation(
			coinRef.current,
			[
				{ transform: `rotateY(${rotation}deg)`, offset: 0 },
				{
					transform: `rotateY(${chaosRotation}deg)`,
					offset: chaosOffset,
					easing: "cubic-bezier(0.18, 0.82, 0.28, 1)",
				},
				{
					transform: `rotateY(${finalRotation}deg)`,
					offset: 1,
					easing: "cubic-bezier(0.08, 0.72, 0.13, 1)",
				},
			],
			{ duration, fill: "forwards" },
		);
		const bobAnimation = startElementAnimation(
			bobRef.current,
			[
				{ transform: "translateY(0) scale(1)", offset: 0 },
				{ transform: "translateY(-24px) scale(1.035)", offset: 0.16 },
				{ transform: "translateY(-14px) scale(1.01)", offset: chaosOffset },
				{ transform: "translateY(1px) scale(0.995)", offset: 0.88 },
				{ transform: "translateY(0) scale(1)", offset: 1 },
			],
			{ duration, easing: "cubic-bezier(0.08, 0.74, 0.16, 1)", fill: "forwards" },
		);
		coinAnimationRef.current = coinAnimation;
		bobAnimationRef.current = bobAnimation;

		if (!coinAnimation) {
			setRotation(finalRotation);
			setSide(result);
			setPhase("settled");
			return;
		}

		void coinAnimation.finished
			.then(() => {
				setRotation(finalRotation);
				setSide(result);
				setPhase("settled");
			})
			.catch(() => undefined);
	}

	function reset() {
		cancelRunningAnimations();
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
						<div ref={bobRef} className={`mg-coin-bob ${phase === "idle" ? "mg-coin-bob-active" : ""}`}>
							<div
								ref={coinRef}
								className={`mg-coin ${phase === "flipping" ? "mg-coin-flipping" : ""} ${phase === "settling" ? "mg-coin-settling" : ""}`}
								style={{ transform: `rotateY(${rotation}deg)` }}
							>
								<div className="mg-coin-face mg-coin-face-blue">
									<span className="mg-coin-mark mg-coin-mark-blue">B</span>
								</div>
								<div className="mg-coin-face mg-coin-face-red">
									<span className="mg-coin-mark mg-coin-mark-red">R</span>
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
