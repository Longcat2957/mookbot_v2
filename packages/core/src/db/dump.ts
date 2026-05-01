// ============================================================
// D1 dump / restore — 모듈 (CLI 아님)
// ============================================================

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execute, query } from "../cloudflare/d1.js";
import { multiInsert } from "./sql.js";

export const SCHEMA_VERSION = "v1";

// FK 의존성 순서 (parent → child) — restore 시 이 순서로 INSERT
export const TABLES_INSERT_ORDER = [
	"users",
	"riot_accounts",
	"seasons",
	"series",
	"series_participants",
	"games",
	"game_stats",
	"user_lane_mmr",
	"mmr_changes",
	"recruitments",
	"recruitment_participants",
	"recruitment_participant_roles",
	"admin_audit_log",
	"guild_kv",
] as const;

// reset / restore 시 child → parent 역순으로 DELETE
export const TABLES_DELETE_ORDER = [...TABLES_INSERT_ORDER].reverse();

export interface DumpFile {
	metadata: {
		timestamp: string;
		schemaVersion: string;
		totalRows: number;
		tableCounts: Record<string, number>;
	};
	tables: Record<string, Record<string, unknown>[]>;
}

export async function dumpDatabase(verbose = true): Promise<{
	path: string;
	totalRows: number;
}> {
	const tables: Record<string, Record<string, unknown>[]> = {};
	let totalRows = 0;
	for (const t of TABLES_INSERT_ORDER) {
		const rows = await query<Record<string, unknown>>(`SELECT * FROM ${t}`);
		tables[t] = rows;
		totalRows += rows.length;
		if (verbose) console.log(`  ${t.padEnd(25)} ${rows.length} rows`);
	}

	mkdirSync("backups", { recursive: true });
	const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
	const path = `backups/d1-${ts}.json`;

	const dump: DumpFile = {
		metadata: {
			timestamp: new Date().toISOString(),
			schemaVersion: SCHEMA_VERSION,
			totalRows,
			tableCounts: Object.fromEntries(Object.entries(tables).map(([t, rows]) => [t, rows.length])),
		},
		tables,
	};

	writeFileSync(path, JSON.stringify(dump, null, 2));
	return { path, totalRows };
}

export async function deleteAllData(verbose = true): Promise<number> {
	let total = 0;
	for (const t of TABLES_DELETE_ORDER) {
		const meta = await execute(`DELETE FROM ${t}`);
		const n = meta.changes ?? 0;
		total += n;
		if (verbose) console.log(`  ${t.padEnd(25)} removed ${n} rows`);
	}
	// reset autoincrement counters (sqlite_sequence)
	await execute(
		`DELETE FROM sqlite_sequence WHERE name IN ('seasons','series','games','mmr_changes')`,
	).catch(() => undefined);
	return total;
}

export function loadDumpFile(path: string): DumpFile {
	const raw = readFileSync(path, "utf-8");
	const parsed = JSON.parse(raw) as DumpFile;
	if (!parsed.metadata || !parsed.tables) {
		throw new Error(`invalid dump file: ${path}`);
	}
	if (parsed.metadata.schemaVersion !== SCHEMA_VERSION) {
		throw new Error(
			`schema version mismatch: dump=${parsed.metadata.schemaVersion}, current=${SCHEMA_VERSION}`,
		);
	}
	return parsed;
}

export async function restoreFromDump(dump: DumpFile, verbose = true): Promise<number> {
	let total = 0;
	for (const t of TABLES_INSERT_ORDER) {
		const rows = dump.tables[t] ?? [];
		if (rows.length === 0) {
			if (verbose) console.log(`  ${t.padEnd(25)} skip (empty)`);
			continue;
		}
		const columns = Object.keys(rows[0]!);
		// chunk to keep statements small (D1 may reject huge SQL)
		const CHUNK = 100;
		for (let i = 0; i < rows.length; i += CHUNK) {
			const chunk = rows.slice(i, i + CHUNK);
			const stmt = multiInsert(
				t,
				columns,
				chunk.map((r) => columns.map((c) => r[c] ?? null)),
			);
			await execute(stmt.sql, stmt.params ?? []);
		}
		total += rows.length;
		if (verbose) console.log(`  ${t.padEnd(25)} inserted ${rows.length} rows`);
	}
	return total;
}
