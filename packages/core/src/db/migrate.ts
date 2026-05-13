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

if (drop) {
	console.log("[migrate] --drop — 기존 테이블 삭제 후 재생성");
	for (const t of TABLES_DELETE_ORDER) {
		await execute(`DROP TABLE IF EXISTS ${t}`);
		console.log(`  ✗ dropped ${t}`);
	}
}

const schemaPath = fileURLToPath(new URL("./schema.sql", import.meta.url));
const raw = readFileSync(schemaPath, "utf-8");

// "-- @atomic-rebuild-begin / -- @atomic-rebuild-end" 마커 사이를 한 SQL 문자열로 보존.
// D1 /query 는 multi-statement 를 한 call 로 받으면 같은 connection 에서 실행 — PRAGMA 가
// connection-scoped 라서 같은 call 안에서만 효과. 마커 밖은 기존대로 ; 분할.
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
			// 일반 statement 스트림에 placeholder 삽입 (정렬 위해)
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
		// inline comment 제거 (atomic placeholder 는 보존)
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

const isDuplicateColumnError = (err: unknown): boolean => {
	const msg = err instanceof Error ? err.message : String(err);
	return /duplicate column/i.test(msg);
};

const isMissingColumnError = (err: unknown): boolean => {
	const msg = err instanceof Error ? err.message : String(err);
	return /no such column/i.test(msg);
};

const isMissingTableError = (err: unknown): boolean => {
	const msg = err instanceof Error ? err.message : String(err);
	return /no such table/i.test(msg);
};

for (const sql of statements) {
	const preview = sql.replace(/\s+/g, " ").slice(0, 70);
	const isAlterAdd = /^\s*ALTER\s+TABLE\s+\S+\s+ADD\s+COLUMN/i.test(sql);
	const isAlterDrop = /^\s*ALTER\s+TABLE\s+\S+\s+DROP\s+COLUMN/i.test(sql);
	// DELETE / UPDATE statements that reference columns / tables which may already
	// have been dropped on a re-run; idempotent skip.
	const isWriteRefMaybeStale = /^\s*(DELETE|UPDATE)\s/i.test(sql);
	// CREATE INDEX 가 아직 ADD COLUMN 안 된 신규 컬럼을 참조 — 같은 인덱스를
	// @migration-only 블록 끝에서 ADD COLUMN 후에 재생성하므로 여기선 idempotent skip.
	const isCreateIndex = /^\s*CREATE\s+(UNIQUE\s+)?INDEX/i.test(sql);
	try {
		await execute(sql);
		console.log(`  ✓ ${preview}`);
	} catch (err) {
		if (isAlterAdd && isDuplicateColumnError(err)) {
			console.log(`  ↺ ${preview} (already applied)`);
			continue;
		}
		if (isAlterDrop && isMissingColumnError(err)) {
			console.log(`  ↺ ${preview} (already dropped)`);
			continue;
		}
		if (isWriteRefMaybeStale && (isMissingColumnError(err) || isMissingTableError(err))) {
			console.log(`  ↺ ${preview} (post-migration cleanup — column/table gone)`);
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
