import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execute, query } from "../cloudflare/d1.js";

config({ path: fileURLToPath(new URL("../../../../.env", import.meta.url)) });

const TABLES_DELETE_ORDER = [
	"guild_kv",
	"admin_audit_log",
	"recruitment_participant_roles",
	"recruitment_participants",
	"recruitments",
	"mmr_changes",
	"user_lane_mmr",
	"game_stats",
	"games",
	"series_participants",
	"series",
	"seasons",
	"riot_accounts",
	"users",
] as const;

const args = new Set(process.argv.slice(2));
const drop = args.has("--drop");

if (drop) {
	console.log("[migrate] --drop — 기존 테이블 삭제 후 재생성");
	for (const t of TABLES_DELETE_ORDER) {
		await execute(`DROP TABLE IF EXISTS ${t}`);
		console.log(`  ✗ dropped ${t}`);
	}
}

const schemaPath = fileURLToPath(new URL("./schema.sql", import.meta.url));
const raw = readFileSync(schemaPath, "utf-8");

const cleaned = raw
	.split("\n")
	.map((line) => {
		const idx = line.indexOf("--");
		return idx >= 0 ? line.slice(0, idx) : line;
	})
	.join("\n");

const statements = cleaned
	.split(";")
	.map((s) => s.trim())
	.filter((s) => s.length > 0);

console.log(`[migrate] applying ${statements.length} statements to D1...`);

const isDuplicateColumnError = (err: unknown): boolean => {
	const msg = err instanceof Error ? err.message : String(err);
	return /duplicate column/i.test(msg);
};

for (const sql of statements) {
	const preview = sql.replace(/\s+/g, " ").slice(0, 70);
	const isAlterAdd = /^\s*ALTER\s+TABLE\s+\S+\s+ADD\s+COLUMN/i.test(sql);
	try {
		await execute(sql);
		console.log(`  ✓ ${preview}`);
	} catch (err) {
		if (isAlterAdd && isDuplicateColumnError(err)) {
			console.log(`  ↺ ${preview} (already applied)`);
			continue;
		}
		console.error(`  ✗ ${preview}`);
		throw err;
	}
}

console.log("[migrate] verifying tables...");
const tables = await query<{ name: string }>(
	"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_%' ESCAPE '\\' ORDER BY name",
);
console.log("  tables:", tables.map((t) => t.name).join(", "));

console.log("[migrate] done.");
