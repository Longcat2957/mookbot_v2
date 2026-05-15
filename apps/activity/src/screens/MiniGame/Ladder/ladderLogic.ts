import { ROWS, RUNG_PROB } from "./constants.js";

export type InputState = "idle" | "running" | "done";

export interface Rung {
	row: number;
	col: number;
}

export interface Geom {
	W: number;
	H: number;
	x: (i: number) => number;
	rowY: (r: number) => number;
	topY: number;
	bottomY: number;
}

export function defaultInputLabel(i: number, count: number): string {
	if (count === 2) return i === 0 ? "1팀" : "2팀";
	return `${i + 1}번`;
}

export function defaultOutputLabel(i: number, count: number): string {
	if (count === 2) return i === 0 ? "BLUE" : "RED";
	return `결과${i + 1}`;
}

export function generateRungs(count: number): Rung[] {
	const rungs: Rung[] = [];
	for (let row = 0; row < ROWS; row++) {
		let prevPlaced = false;
		for (let col = 0; col < count - 1; col++) {
			if (prevPlaced) {
				prevPlaced = false;
				continue;
			}
			if (Math.random() < RUNG_PROB) {
				rungs.push({ row, col });
				prevPlaced = true;
			}
		}
	}
	return rungs;
}

export function simulate(count: number, rungs: Rung[]): number[] {
	const set = new Set(rungs.map((r) => `${r.row}:${r.col}`));
	const results: number[] = [];
	for (let i = 0; i < count; i++) {
		let col = i;
		for (let row = 0; row < ROWS; row++) {
			if (set.has(`${row}:${col}`)) col += 1;
			else if (col > 0 && set.has(`${row}:${col - 1}`)) col -= 1;
		}
		results.push(col);
	}
	return results;
}

export function buildLadderGeom(count: number): Geom {
	const spacing = 80;
	const padX = 40;
	const W = padX * 2 + Math.max(0, count - 1) * spacing;
	const H = 360;
	const topY = 50;
	const bottomY = H - 60;
	const x = (i: number) => padX + i * spacing;
	const rowY = (row: number) => topY + ((row + 1) * (bottomY - topY)) / (ROWS + 1);
	return { W, H, x, topY, bottomY, rowY };
}

export function buildPath(startCol: number, rungs: Rung[], geom: Geom): string {
	const set = new Set(rungs.map((r) => `${r.row}:${r.col}`));
	let col = startCol;
	const parts: string[] = [`M ${geom.x(col)} ${geom.topY}`];
	for (let row = 0; row < ROWS; row++) {
		parts.push(`L ${geom.x(col)} ${geom.rowY(row)}`);
		if (set.has(`${row}:${col}`)) {
			parts.push(`L ${geom.x(col + 1)} ${geom.rowY(row)}`);
			col += 1;
		} else if (col > 0 && set.has(`${row}:${col - 1}`)) {
			parts.push(`L ${geom.x(col - 1)} ${geom.rowY(row)}`);
			col -= 1;
		}
	}
	parts.push(`L ${geom.x(col)} ${geom.bottomY}`);
	return parts.join(" ");
}

export function rungsAlongPath(startCol: number, rungs: Rung[]): number[] {
	const byCoord = new Map<string, number>();
	for (let i = 0; i < rungs.length; i++) {
		const rung = rungs[i];
		if (rung) byCoord.set(`${rung.row}:${rung.col}`, i);
	}

	const indices: number[] = [];
	let col = startCol;
	for (let row = 0; row < ROWS; row++) {
		const rightIdx = byCoord.get(`${row}:${col}`);
		if (rightIdx !== undefined) {
			indices.push(rightIdx);
			col += 1;
			continue;
		}
		if (col > 0) {
			const leftIdx = byCoord.get(`${row}:${col - 1}`);
			if (leftIdx !== undefined) {
				indices.push(leftIdx);
				col -= 1;
			}
		}
	}
	return indices;
}
