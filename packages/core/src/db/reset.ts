import { config } from "dotenv";
import { deleteAllData, dumpDatabase } from "./dump.js";

config();

const args = new Set(process.argv.slice(2));
const confirmed = args.has("--confirm") || process.env.DB_RESET_CONFIRM === "yes";
const skipBackup = args.has("--skip-backup");

if (!confirmed) {
	console.error("[reset] ⚠️  운영 D1 의 모든 데이터를 삭제합니다.");
	console.error("        실행하려면 --confirm 플래그 또는 DB_RESET_CONFIRM=yes 가 필요합니다.");
	console.error("        예: pnpm run db:reset -- --confirm");
	process.exit(1);
}

if (!skipBackup) {
	console.log("[reset] step 1/2 — 자동 백업 생성");
	const { path, totalRows } = await dumpDatabase();
	console.log(`        백업 저장: ${path} (${totalRows}행)`);
} else {
	console.log("[reset] step 1/2 — 백업 스킵 (--skip-backup)");
}

console.log("[reset] step 2/2 — 데이터 삭제");
const removed = await deleteAllData();

console.log(`[reset] 완료 — ${removed}행 삭제, 스키마는 유지.`);
