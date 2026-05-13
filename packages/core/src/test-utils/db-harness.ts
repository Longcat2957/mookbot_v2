// In-memory SQLite (better-sqlite3) 테스트 하네스.
// d1.ts 의 driver indirection 을 활용 — vi.mock 불필요, cross-package 사용 가능.
//
// 패턴:
//   beforeEach(() => {
//     const db = createTestDb();
//     installDbDriver(db);   // d1.ts driver 를 SQLite 백엔드로 swap
//   });
//   afterEach(() => __resetDriver());

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { __resetDriver, __setDriver, type D1Driver } from "../cloudflare/d1.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(here, "..", "db", "schema.sql");

let cachedSchema: string | null = null;

function loadSchema(): string {
	if (cachedSchema !== null) return cachedSchema;
	const raw = readFileSync(SCHEMA_PATH, "utf8");
	// schema.sql 끝에 "Idempotent ALTER TABLE migrations" 블록이 있음 — 기존 DB
	// 보강용. fresh in-memory 에선 CREATE TABLE 에 이미 컬럼이 포함되어 있어
	// ALTER 가 "duplicate column" 으로 실패. 테스트에선 ALTER 라인 제거.
	//
	// 또한 `-- @migration-only-begin` ~ `-- @migration-only-end` 로 감싼 블록은
	// 기존 DB 마이그레이션 전용 (DELETE / UPDATE / DROP / 재생성) — fresh DB 에선
	// 이미 새 schema 로 CREATE 됐으므로 의미 없거나 깨짐. 통째로 제거.
	const stripped: string[] = [];
	let inMigrationBlock = false;
	for (const line of raw.split("\n")) {
		if (/--\s*@migration-only-begin/i.test(line)) {
			inMigrationBlock = true;
			continue;
		}
		if (/--\s*@migration-only-end/i.test(line)) {
			inMigrationBlock = false;
			continue;
		}
		if (inMigrationBlock) continue;
		if (/^\s*ALTER\s+TABLE/i.test(line)) continue;
		stripped.push(line);
	}
	cachedSchema = stripped.join("\n");
	return cachedSchema;
}

export type TestDb = Database.Database;

/**
 * 새 in-memory SQLite + FK ON + 전체 schema 적용.
 */
export function createTestDb(): TestDb {
	const db = new Database(":memory:");
	db.pragma("foreign_keys = ON");
	db.exec(loadSchema());
	return db;
}

/**
 * 주어진 SQLite 인스턴스를 d1.ts driver 로 install.
 * production 의 HTTP driver 를 대체 — `__resetDriver()` 로 복구 가능.
 */
export function installDbDriver(db: TestDb): void {
	const driver: D1Driver = {
		async query<T>(sql: string, params: unknown[]): Promise<T[]> {
			const stmt = db.prepare(sql);
			return stmt.all(...(params as never[])) as T[];
		},
		async queryOne<T>(sql: string, params: unknown[]): Promise<T | undefined> {
			const stmt = db.prepare(sql);
			return stmt.get(...(params as never[])) as T | undefined;
		},
		async execute(sql: string, params: unknown[]) {
			const stmt = db.prepare(sql);
			const r = stmt.run(...(params as never[]));
			return {
				duration: 0,
				rows_read: 0,
				rows_written: r.changes,
				last_row_id: Number(r.lastInsertRowid),
				changes: r.changes,
			};
		},
		async batch(statements) {
			const out: {
				results: unknown[];
				success: true;
				meta: { duration: number; rows_read: number; rows_written: number };
			}[] = [];
			for (const stmt of statements) {
				const prepared = db.prepare(stmt.sql);
				const params = (stmt.params ?? []) as never[];
				if (prepared.reader) {
					const rows = prepared.all(...params);
					out.push({
						results: rows,
						success: true,
						meta: { duration: 0, rows_read: rows.length, rows_written: 0 },
					});
				} else {
					const r = prepared.run(...params);
					out.push({
						results: [],
						success: true,
						meta: { duration: 0, rows_read: 0, rows_written: r.changes },
					});
				}
			}
			return out;
		},
	};
	__setDriver(driver);
}

export { __resetDriver };

/**
 * @deprecated installDbDriver 사용. 호환성 유지.
 */
export const installDbMock = installDbDriver;
