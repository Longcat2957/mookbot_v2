import { MAX_COUNT, ROWS, RUNG_PROB } from "./constants.js";

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

export interface Point {
	x: number;
	y: number;
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
	// 10인 기준으로 W/H 고정. count 가 적으면 posts 가운데 정렬 (spacing 80 유지).
	const spacing = 80;
	const padX = 50;
	const W = padX * 2 + (MAX_COUNT - 1) * spacing;
	const H = Math.min(360, 220 + MAX_COUNT * 14);
	const topY = 42;
	const bottomY = H - 60;
	const usedWidth = Math.max(0, count - 1) * spacing;
	const startX = (W - usedWidth) / 2;
	const x = (i: number) => startX + i * spacing;
	const rowY = (row: number) => topY + ((row + 1) * (bottomY - topY)) / (ROWS + 1);
	return { W, H, x, topY, bottomY, rowY };
}

export function buildPath(startCol: number, rungs: Rung[], geom: Geom): string {
	return buildPathPoints(startCol, rungs, geom)
		.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
		.join(" ");
}

export function buildPathPoints(startCol: number, rungs: Rung[], geom: Geom): Point[] {
	const set = new Set(rungs.map((r) => `${r.row}:${r.col}`));
	let col = startCol;
	const points: Point[] = [{ x: geom.x(col), y: geom.topY }];
	for (let row = 0; row < ROWS; row++) {
		points.push({ x: geom.x(col), y: geom.rowY(row) });
		if (set.has(`${row}:${col}`)) {
			points.push({ x: geom.x(col + 1), y: geom.rowY(row) });
			col += 1;
		} else if (col > 0 && set.has(`${row}:${col - 1}`)) {
			points.push({ x: geom.x(col - 1), y: geom.rowY(row) });
			col -= 1;
		}
	}
	points.push({ x: geom.x(col), y: geom.bottomY });
	return points;
}

export function pointAtProgress(points: Point[], progress: number): Point {
	if (points.length === 0) return { x: 0, y: 0 };
	if (points.length === 1) return points[0] ?? { x: 0, y: 0 };

	const segments: Array<{ from: Point; to: Point; length: number }> = [];
	let total = 0;
	for (let i = 1; i < points.length; i++) {
		const from = points[i - 1];
		const to = points[i];
		if (!from || !to) continue;
		const length = Math.hypot(to.x - from.x, to.y - from.y);
		segments.push({ from, to, length });
		total += length;
	}
	if (total <= 0) return points[0] ?? { x: 0, y: 0 };

	let remaining = Math.max(0, Math.min(1, progress)) * total;
	for (const segment of segments) {
		if (remaining > segment.length) {
			remaining -= segment.length;
			continue;
		}
		const t = segment.length === 0 ? 1 : remaining / segment.length;
		return {
			x: segment.from.x + (segment.to.x - segment.from.x) * t,
			y: segment.from.y + (segment.to.y - segment.from.y) * t,
		};
	}
	return points.at(-1) ?? points[0] ?? { x: 0, y: 0 };
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
