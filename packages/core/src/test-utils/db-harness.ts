// In-memory SQLite (better-sqlite3) 테스트 하네스.
// production 의 cloudflare/d1.ts 4 export 를 vi.mock 으로 swap 하면
// db/* 의 모든 함수가 in-memory SQLite 위에서 실행됨.
//
// schema 는 packages/core/src/db/schema.sql 을 매번 읽음 → 스키마 드리프트 0.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { vi } from "vitest";
import * as d1 from "../cloudflare/d1.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(here, "..", "db", "schema.sql");

let cachedSchema: string | null = null;

function loadSchema(): string {
	if (cachedSchema !== null) return cachedSchema;
	const raw = readFileSync(SCHEMA_PATH, "utf8");
	// schema.sql 끝에 "Idempotent ALTER TABLE migrations" 블록이 있음 — 기존 DB
	// 보강용. fresh in-memory 에선 CREATE TABLE 에 이미 컬럼이 포함되어 있어
	// ALTER 가 "duplicate column" 으로 실패. 테스트에선 ALTER 라인만 제거.
	cachedSchema = raw
		.split("\n")
		.filter((l) => !/^\s*ALTER\s+TABLE/i.test(l))
		.join("\n");
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
 * `cloudflare/d1.ts` 의 4 export (query/queryOne/execute/batch) 를
 * 주어진 SQLite 인스턴스로 위임하도록 vi.mock 동작을 install.
 *
 * 사용법:
 *   import { vi } from "vitest";
 *   vi.mock("../cloudflare/d1.js");          // top-level (hoisted)
 *
 *   beforeEach(() => {
 *     const db = createTestDb();
 *     installDbMock(db);
 *   });
 *
 * D1 의 meta 필드는 better-sqlite3 의 RunResult 에서 매핑:
 *   - last_row_id: lastInsertRowid (BigInt|number → number)
 *   - changes:     changes
 */
export function installDbMock(db: TestDb): void {
	vi.mocked(d1.query).mockImplementation(<T>(sql: string, params: unknown[] = []): Promise<T[]> => {
		const stmt = db.prepare(sql);
		const rows = stmt.all(...(params as never[])) as T[];
		return Promise.resolve(rows);
	});

	vi
		.mocked(d1.queryOne)
		.mockImplementation(<T>(sql: string, params: unknown[] = []): Promise<T | undefined> => {
			const stmt = db.prepare(sql);
			const row = stmt.get(...(params as never[])) as T | undefined;
			return Promise.resolve(row);
		});

	vi.mocked(d1.execute).mockImplementation((sql: string, params: unknown[] = []) => {
		const stmt = db.prepare(sql);
		const result = stmt.run(...(params as never[]));
		return Promise.resolve({
			duration: 0,
			rows_read: 0,
			rows_written: result.changes,
			last_row_id: Number(result.lastInsertRowid),
			changes: result.changes,
		});
	});

	vi.mocked(d1.batch).mockImplementation(async (statements) => {
		const out: {
			results: unknown[];
			success: true;
			meta: { duration: number; rows_read: number; rows_written: number };
		}[] = [];
		for (const stmt of statements) {
			const prepared = db.prepare(stmt.sql);
			const params = (stmt.params ?? []) as never[];
			// SELECT vs write 구분 — better-sqlite3 의 readonly 플래그 사용
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
	});
}
