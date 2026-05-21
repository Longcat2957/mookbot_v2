import { readFileSync } from "node:fs";

export type BenchmarkMetric = "kills" | "kda" | "deaths" | "csm";
export type BenchmarkRole = "top" | "jungle" | "middle" | "bottom";
export type BenchmarkTier =
	| "IRON"
	| "BRONZE"
	| "SILVER"
	| "GOLD"
	| "PLATINUM"
	| "EMERALD"
	| "DIAMOND"
	| "MASTER"
	| "GRANDMASTER"
	| "CHALLENGER";

export interface BenchmarkRow {
	key: BenchmarkTier;
	value: number;
	redside: number;
	blueside: number;
	total: number;
}

type BenchmarkFile = Record<BenchmarkMetric, Record<BenchmarkRole, BenchmarkRow[]>>;

const BENCHMARK_URL = new URL("./benchmarks.json", import.meta.url);

let cachedBenchmarks: BenchmarkFile | null = null;

export function getBenchmarkRow(input: {
	metric: BenchmarkMetric;
	role: BenchmarkRole;
	tier: string | null;
	side?: "BLUE" | "RED" | null;
}): { baseline: number; row: BenchmarkRow } | null {
	const tier = normalizeBenchmarkTier(input.tier);
	if (!tier) return null;
	const row = loadBenchmarks()[input.metric]?.[input.role]?.find((item) => item.key === tier);
	if (!row || !isUsableRow(row)) return null;
	const baseline =
		input.side === "BLUE" ? row.blueside : input.side === "RED" ? row.redside : row.value;
	return { baseline, row };
}

export function normalizeBenchmarkRole(lane: string | null): BenchmarkRole | null {
	switch (lane) {
		case "TOP":
			return "top";
		case "JUNGLE":
			return "jungle";
		case "MIDDLE":
			return "middle";
		case "BOTTOM":
			return "bottom";
		default:
			return null;
	}
}

export function normalizeBenchmarkTier(tier: string | null): BenchmarkTier | null {
	if (!tier) return null;
	const normalized = tier.toUpperCase();
	return isBenchmarkTier(normalized) ? normalized : null;
}

function loadBenchmarks(): BenchmarkFile {
	if (cachedBenchmarks) return cachedBenchmarks;
	const parsed = JSON.parse(readFileSync(BENCHMARK_URL, "utf8")) as BenchmarkFile;
	cachedBenchmarks = parsed;
	return parsed;
}

function isBenchmarkTier(value: string): value is BenchmarkTier {
	return (
		value === "IRON" ||
		value === "BRONZE" ||
		value === "SILVER" ||
		value === "GOLD" ||
		value === "PLATINUM" ||
		value === "EMERALD" ||
		value === "DIAMOND" ||
		value === "MASTER" ||
		value === "GRANDMASTER" ||
		value === "CHALLENGER"
	);
}

function isUsableRow(row: BenchmarkRow): boolean {
	return (
		Number.isFinite(row.value) &&
		Number.isFinite(row.redside) &&
		Number.isFinite(row.blueside) &&
		Number.isFinite(row.total) &&
		row.total > 0
	);
}
