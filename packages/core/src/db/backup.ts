import { config } from "dotenv";
import { dumpDatabase } from "./dump.js";

config();

console.log("[backup] D1 export 시작...");
const { path, totalRows } = await dumpDatabase();
console.log(`[backup] 완료 — ${totalRows}행 저장: ${path}`);
