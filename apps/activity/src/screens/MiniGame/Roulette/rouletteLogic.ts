import { SEGMENT_COLORS, SPINS_MAX, SPINS_MIN } from "./constants.js";

export function buildConicGradient(count: number, segmentSize: number): string {
	const stops: string[] = [];
	const gap = Math.min(1.2, segmentSize * 0.08);
	for (let i = 0; i < count; i++) {
		const start = i * segmentSize;
		const end = (i + 1) * segmentSize;
		const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
		stops.push(
			`rgba(255, 255, 255, 0.24) ${start}deg ${start + gap}deg`,
			`${color} ${start + gap}deg ${end - gap}deg`,
			`rgba(0, 0, 0, 0.2) ${end - gap}deg ${end}deg`,
		);
	}
	return `conic-gradient(from 0deg, ${stops.join(", ")})`;
}

export function nextSpinRotation({
	rotation,
	result,
	segmentSize,
}: {
	rotation: number;
	result: number;
	segmentSize: number;
}) {
	const fullSpins = SPINS_MIN + Math.floor(Math.random() * (SPINS_MAX - SPINS_MIN + 1));
	// 결과 segment 내부 랜덤 오프셋. 경계 닿으면 어느 칸 당첨인지 헷갈리니 양 끝 15% margin 유지.
	const margin = 0.15;
	const offset = margin + Math.random() * (1 - margin * 2);
	const targetResidual = (360 - (result + offset) * segmentSize + 720) % 360;
	const currentResidual = ((rotation % 360) + 360) % 360;
	return rotation + fullSpins * 360 + ((targetResidual - currentResidual + 360) % 360);
}

export function randomResult(count: number): number {
	return Math.floor(Math.random() * count);
}
