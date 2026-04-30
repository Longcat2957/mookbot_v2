import { config } from "dotenv";
import { loadDumpFile, restoreFromDump } from "./dump.js";

config();

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");

if (!file) {
	console.error("usage: pnpm run db:restore <backup_file.json> [--dry-run]");
	process.exit(1);
}

console.log(`[restore] reading ${file}`);
const dump = loadDumpFile(file);
console.log(`          schema: ${dump.metadata.schemaVersion} · ${dump.metadata.totalRows}행 (${dump.metadata.timestamp})`);

if (dryRun) {
	console.log("[restore] dry-run — 다음 행이 INSERT 될 예정:");
	for (const [t, count] of Object.entries(dump.metadata.tableCounts)) {
		console.log(`  ${t.padEnd(25)} ${count} rows`);
	}
	console.log("[restore] dry-run 종료 — DB 변경 없음.");
	process.exit(0);
}

console.log("[restore] inserting...");
const inserted = await restoreFromDump(dump);
console.log(`[restore] 완료 — ${inserted}행 복원.`);
