export const MIN_COUNT = 2;
export const MAX_COUNT = 8;
export const SPIN_DURATION_MS = 4000;
export const SPINS_MIN = 4;
export const SPINS_MAX = 7;

export const SEGMENT_COLORS = [
	"#3b82f6",
	"#ef4444",
	"#22c55e",
	"#f59e0b",
	"#a855f7",
	"#06b6d4",
	"#ec4899",
	"#84cc16",
];

export type Phase = "idle" | "spinning" | "settled";

export function defaultLabel(index: number, count: number): string {
	if (count === 2) return index === 0 ? "BLUE" : "RED";
	return `${index + 1}`;
}
