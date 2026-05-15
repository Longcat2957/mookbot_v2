import { SEGMENT_COLORS, SPINS_MAX, SPINS_MIN } from "./constants.js";

export function buildConicGradient(count: number, segmentSize: number): string {
	const stops: string[] = [];
	for (let i = 0; i < count; i++) {
		const start = i * segmentSize;
		const end = (i + 1) * segmentSize;
		const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
		stops.push(`${color} ${start}deg ${end}deg`);
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
	const targetResidual = (360 - (result + 0.5) * segmentSize + 720) % 360;
	const currentResidual = ((rotation % 360) + 360) % 360;
	return rotation + fullSpins * 360 + ((targetResidual - currentResidual + 360) % 360);
}

export function randomResult(count: number): number {
	return Math.floor(Math.random() * count);
}
