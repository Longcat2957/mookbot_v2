import type { D1Statement } from "../cloudflare/d1.js";

/**
 * Build a multi-row INSERT statement.
 *   multiInsert("t", ["a", "b"], [[1, 2], [3, 4]])
 *   → INSERT INTO t (a, b) VALUES (?, ?), (?, ?)  /  params: [1, 2, 3, 4]
 */
export function multiInsert(
	table: string,
	columns: readonly string[],
	rows: readonly (readonly unknown[])[],
): D1Statement {
	if (rows.length === 0) {
		throw new Error(`multiInsert: no rows for table ${table}`);
	}
	for (const row of rows) {
		if (row.length !== columns.length) {
			throw new Error(
				`multiInsert(${table}): row length ${row.length} ≠ ${columns.length} columns`,
			);
		}
	}
	const placeholder = `(${columns.map(() => "?").join(", ")})`;
	const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${rows.map(() => placeholder).join(", ")}`;
	return { sql, params: rows.flatMap((r) => [...r]) };
}

/**
 * Build a parameterized IN clause from a list of values.
 *   inClause(["a", "b"]) → { placeholders: "(?, ?)", params: ["a", "b"] }
 */
export function inClause(values: readonly unknown[]): {
	placeholders: string;
	params: unknown[];
} {
	if (values.length === 0) {
		return { placeholders: "(NULL)", params: [] };
	}
	return {
		placeholders: `(${values.map(() => "?").join(", ")})`,
		params: [...values],
	};
}
