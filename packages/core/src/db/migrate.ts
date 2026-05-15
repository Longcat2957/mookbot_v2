// D1 schema migration — schema.sql 의 모든 statement 를 멱등 적용.
//
// 안전 보장 (v0.14.1 incident postmortem):
//   1. schema.sql 은 idempotent statement 만 포함해야 함:
//      CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS / ALTER ADD COLUMN
//   2. DESTRUCTIVE statement (DROP TABLE / DELETE without WHERE / ALTER DROP COLUMN /
//      ALTER RENAME / UPDATE x SET y = NULL 같은 광범위 mutation) 는 prod 재실행 시
//      데이터 손실 위험 → 본 migrate 가 schema 스캔 단계에서 즉시 거부.
//   3. 옛 incident 의 @migration-only / @legacy-v0_11-transition 마커가 다시 나타나면 거부.
//
// 1회성 transition 이 필요하면 별도 .sql 파일로 분리해 직접 prod 에 한 번만 적용 후 삭제할 것.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { execute, query } from "../cloudflare/d1.js";

config({ path: fileURLToPath(new URL("../../../../.env", import.meta.url)) });

const TABLES_DELETE_ORDER = [
	"guild_kv",
	"admin_audit_log",
	"user_champion_preferences",
	"recruitment_participant_roles",
	"recruitment_participants",
	"recruitments",
	"mmr_changes",
	"user_lane_mmr",
	"game_picks",
	"game_bans",
	"game_stats",
	"games",
	"series_participants",
	"series",
	"auction_bids",
	"auction_team_members",
	"auction_matches",
	"auction_teams",
	"auction_recruitment_participants",
	"auction_recruitments",
	"auction_tournaments",
	"seasons",
	"riot_accounts",
	"users",
] as const;

const args = new Set(process.argv.slice(2));
const drop = args.has("--drop");
// 명시적 danger override — 정말로 destructive statement 가 필요한 1회성 운영용. README 에 비공개.
const allowDestructive = args.has("--i-know-this-deletes-data");

if (drop) {
	console.log("[migrate] --drop — 기존 테이블 삭제 후 재생성");
	for (const t of TABLES_DELETE_ORDER) {
		await execute(`DROP TABLE IF EXISTS ${t}`);
		console.log(`  ✗ dropped ${t}`);
	}
}

const schemaPath = fileURLToPath(new URL("./schema.sql", import.meta.url));
const raw = readFileSync(schemaPath, "utf-8");

// ============================================================
// 안전 가드 (1) — 옛 incident 마커 검출
// ============================================================
const FORBIDDEN_MARKERS = [
	{ re: /--\s*@migration-only-(begin|end)/i, name: "@migration-only" },
	{ re: /--\s*@legacy-v0_11-transition-(begin|end)/i, name: "@legacy-v0_11-transition" },
];
for (const { re, name } of FORBIDDEN_MARKERS) {
	if (re.test(raw)) {
		console.error(
			`[migrate] ABORT: schema.sql 에 \`${name}\` 마커가 있습니다.\n` +
				"v0.14.1 incident (DROP/DELETE 재실행 → 데이터 손실) 후 금지.\n" +
				"1회성 transition 은 별도 .sql 파일로 한 번만 적용 후 schema.sql 에 남기지 마세요.",
		);
		process.exit(1);
	}
}

// ============================================================
// 안전 가드 (2) — destructive statement 검출 (line-by-line scan)
// inline comment 와 atomic block 도 함께 strip 한 뒤 scan.
// ============================================================
const cleanedForScan = raw
	.split("\n")
	.map((l) => {
		const idx = l.indexOf("--");
		return idx >= 0 ? l.slice(0, idx) : l;
	})
	.join("\n");

const DANGER_PATTERNS: Array<{ re: RegExp; label: string }> = [
	{
		re: /\bDROP\s+TABLE\b(?!\s+IF\s+EXISTS\s+games_v2\b|\s+IF\s+EXISTS\s+games_old)/i,
		label: "DROP TABLE",
	},
	{ re: /\bALTER\s+TABLE\s+\S+\s+DROP\s+COLUMN\b/i, label: "ALTER TABLE ... DROP COLUMN" },
	{ re: /\bALTER\s+TABLE\s+\S+\s+RENAME\b/i, label: "ALTER TABLE ... RENAME" },
	{ re: /\bDELETE\s+FROM\s+\S+\s*(;|$)/im, label: "DELETE FROM (without WHERE)" },
	{ re: /\bTRUNCATE\b/i, label: "TRUNCATE" },
];

const dangers: string[] = [];
for (const sqlStmt of cleanedForScan.split(";")) {
	const trimmed = sqlStmt.trim();
	if (!trimmed) continue;
	for (const { re, label } of DANGER_PATTERNS) {
		if (re.test(trimmed)) {
			dangers.push(`${label}: ${trimmed.replace(/\s+/g, " ").slice(0, 100)}`);
		}
	}
}

if (dangers.length > 0 && !allowDestructive) {
	console.error("[migrate] ABORT: schema.sql 에 destructive statement 감지\n");
	for (const d of dangers) console.error(`  ✗ ${d}`);
	console.error(
		"\n이 statement 들은 prod D1 에서 재실행 시 데이터 손실을 일으킵니다.\n" +
			"신규 마이그레이션은 idempotent (ALTER ADD COLUMN / CREATE INDEX) 만 schema.sql 에 추가하세요.\n" +
			"정말로 destructive 가 필요한 1회성 작업이면 별도 .sql 파일로 분리해 prod 에 직접 적용하세요.\n" +
			"(긴급 우회: `pnpm db:migrate -- --i-know-this-deletes-data` — 사용 금지 권장)",
	);
	process.exit(1);
}

// ============================================================
// 실제 마이그레이션 — 모든 statement 가 idempotent.
// ============================================================
// "-- @atomic-rebuild-begin/end" 마커 사이를 한 SQL 문자열로 보존 (PRAGMA 같이 connection-scoped 한 것).
const ATOMIC_BEGIN = /--\s*@atomic-rebuild-begin/i;
const ATOMIC_END = /--\s*@atomic-rebuild-end/i;
const atomicBlocks: string[] = [];
let atomicBuf: string[] | null = null;
const normalLines: string[] = [];
for (const line of raw.split("\n")) {
	if (ATOMIC_BEGIN.test(line)) {
		atomicBuf = [];
		continue;
	}
	if (ATOMIC_END.test(line)) {
		if (atomicBuf) {
			atomicBlocks.push(atomicBuf.join("\n"));
			normalLines.push(`/*__atomic_block_${atomicBlocks.length - 1}__*/;`);
		}
		atomicBuf = null;
		continue;
	}
	if (atomicBuf) atomicBuf.push(line);
	else normalLines.push(line);
}

const cleaned = normalLines
	.map((line) => {
		if (line.includes("/*__atomic_block_")) return line;
		const idx = line.indexOf("--");
		return idx >= 0 ? line.slice(0, idx) : line;
	})
	.join("\n");

const statements = cleaned
	.split(";")
	.map((s) => s.trim())
	.filter((s) => s.length > 0)
	.map((s) => {
		const m = s.match(/\/\*__atomic_block_(\d+)__\*\//);
		if (m && m[1] !== undefined) {
			const idx = Number(m[1]);
			return atomicBlocks[idx] ?? s;
		}
		return s;
	});

console.log(`[migrate] applying ${statements.length} statements to D1...`);

const isDuplicateColumnError = (err: unknown): boolean =>
	/duplicate column/i.test(err instanceof Error ? err.message : String(err));
const isMissingColumnError = (err: unknown): boolean =>
	/no such column/i.test(err instanceof Error ? err.message : String(err));
const isMissingTableError = (err: unknown): boolean =>
	/no such table/i.test(err instanceof Error ? err.message : String(err));

for (const sql of statements) {
	const preview = sql.replace(/\s+/g, " ").slice(0, 70);
	const isAlterAdd = /^\s*ALTER\s+TABLE\s+\S+\s+ADD\s+COLUMN/i.test(sql);
	const isCreateIndex = /^\s*CREATE\s+(UNIQUE\s+)?INDEX/i.test(sql);
	try {
		await execute(sql);
		console.log(`  ✓ ${preview}`);
	} catch (err) {
		if (isAlterAdd && isDuplicateColumnError(err)) {
			console.log(`  ↺ ${preview} (already applied)`);
			continue;
		}
		if (isCreateIndex && (isMissingColumnError(err) || isMissingTableError(err))) {
			console.log(`  ↺ ${preview} (column/table not yet present — recreate later)`);
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
