// ============================================================
// Cloudflare D1 — minimal HTTP client + swappable driver
// ============================================================
//
// D1 REST API:
//   POST /accounts/{account_id}/d1/database/{database_id}/query
//   body: { sql, params? }   or   [{ sql, params? }, ...] for batch
//
// Required env: CF_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_API_TOKEN
//
// Driver indirection: prod 코드는 항상 default HTTP driver 를 사용한다.
// 테스트는 `__setDriver()` 로 in-memory SQLite 등으로 swap 가능. prod 영향 0
// (driver 함수 호출 1번 추가 — HTTP fetch latency 대비 무시 가능).

interface D1Meta {
	duration: number;
	rows_read: number;
	rows_written: number;
	last_row_id?: number;
	changes?: number;
}

interface D1Result<T> {
	results: T[];
	success: boolean;
	meta: D1Meta;
}

interface D1ApiError {
	code: number;
	message: string;
}

interface D1Envelope<T> {
	result: D1Result<T>[];
	success: boolean;
	errors: D1ApiError[];
	messages: unknown[];
}

export interface D1Statement {
	sql: string;
	params?: unknown[];
}

// ------------------------------------------------------------
// Driver (테스트 swap 용 indirection)
// ------------------------------------------------------------

export interface D1Driver {
	query<T>(sql: string, params: unknown[]): Promise<T[]>;
	queryOne<T>(sql: string, params: unknown[]): Promise<T | undefined>;
	execute(sql: string, params: unknown[]): Promise<D1Meta>;
	batch(statements: D1Statement[]): Promise<D1Result<unknown>[]>;
}

// ------------------------------------------------------------
// Lazy config (so dotenv can run before this is read)
// ------------------------------------------------------------

let _endpoint: string | undefined;
let _token: string | undefined;

function getConfig(): { endpoint: string; token: string } {
	if (!_endpoint || !_token) {
		const accountId = process.env.CF_ACCOUNT_ID;
		const dbId = process.env.CLOUDFLARE_D1_DATABASE_ID;
		const token = process.env.CLOUDFLARE_API_TOKEN;
		if (!accountId || !dbId || !token) {
			throw new Error(
				"Cloudflare D1 env missing: CF_ACCOUNT_ID / CLOUDFLARE_D1_DATABASE_ID / CLOUDFLARE_API_TOKEN",
			);
		}
		_endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`;
		_token = token;
	}
	return { endpoint: _endpoint, token: _token };
}

// ------------------------------------------------------------
// HTTP driver (production)
// ------------------------------------------------------------

async function httpCall<T>(body: D1Statement): Promise<D1Result<T>[]> {
	const { endpoint, token } = getConfig();
	const res = await fetch(endpoint, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});

	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`D1 HTTP ${res.status}: ${res.statusText} — ${text}`);
	}

	const env = (await res.json()) as D1Envelope<T>;
	if (!env.success) {
		const msg = env.errors.map((e) => `[${e.code}] ${e.message}`).join("; ");
		throw new Error(`D1 query failed: ${msg || "unknown error"}`);
	}
	return env.result;
}

const httpDriver: D1Driver = {
	async query<T>(sql: string, params: unknown[]): Promise<T[]> {
		const result = await httpCall<T>({ sql, params });
		return result[0]?.results ?? [];
	},
	async queryOne<T>(sql: string, params: unknown[]): Promise<T | undefined> {
		const result = await httpCall<T>({ sql, params });
		return result[0]?.results?.[0];
	},
	async execute(sql: string, params: unknown[]): Promise<D1Meta> {
		const result = await httpCall<unknown>({ sql, params });
		if (!result[0]) throw new Error("D1 execute returned no result");
		return result[0].meta;
	},
	async batch(statements: D1Statement[]): Promise<D1Result<unknown>[]> {
		if (statements.length === 0) return [];
		const results: D1Result<unknown>[] = [];
		for (const stmt of statements) {
			const r = await httpCall<unknown>(stmt);
			if (r[0]) results.push(r[0]);
		}
		return results;
	},
};

let driver: D1Driver = httpDriver;

/**
 * 테스트 전용 — driver 를 swap. production 은 import-time 의 HTTP driver 사용.
 * 테스트가 끝나면 `__resetDriver()` 또는 `__setDriver(httpDriver)` 로 복구.
 */
export function __setDriver(d: D1Driver): void {
	driver = d;
}

/**
 * 테스트 전용 — driver 를 default HTTP driver 로 복구.
 */
export function __resetDriver(): void {
	driver = httpDriver;
}

// ------------------------------------------------------------
// Public API (driver 위임)
// ------------------------------------------------------------

/**
 * Run a SELECT and get rows back.
 * Returns [] if no rows match.
 */
export async function query<T = Record<string, unknown>>(
	sql: string,
	params: unknown[] = [],
): Promise<T[]> {
	return driver.query<T>(sql, params);
}

/**
 * Run a SELECT expected to return at most one row.
 */
export async function queryOne<T = Record<string, unknown>>(
	sql: string,
	params: unknown[] = [],
): Promise<T | undefined> {
	return driver.queryOne<T>(sql, params);
}

/**
 * Run an INSERT/UPDATE/DELETE/DDL. Returns the meta (last_row_id, changes).
 */
export async function execute(sql: string, params: unknown[] = []): Promise<D1Meta> {
	return driver.execute(sql, params);
}

/**
 * Run multiple statements sequentially.
 *
 * NOTE: D1's HTTP /query endpoint accepts only a single statement per request,
 * so this is NOT atomic across statements. Each statement is its own HTTP call.
 * Callers needing rollback semantics must order statements such that a failure
 * mid-batch can be cleaned up via cascading deletes (see `services/db/record.ts`).
 *
 * Within a single statement (e.g. multi-row INSERT), SQLite's own atomicity
 * still applies — it commits all rows or none.
 */
export async function batch(statements: D1Statement[]): Promise<D1Result<unknown>[]> {
	return driver.batch(statements);
}
