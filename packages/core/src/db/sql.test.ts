import { describe, expect, it } from "vitest";
import { inClause, multiInsert } from "./sql.js";

describe("multiInsert", () => {
	it("기본 동작 — 2 rows × 2 cols", () => {
		const stmt = multiInsert(
			"t",
			["a", "b"],
			[
				[1, 2],
				[3, 4],
			],
		);
		expect(stmt.sql).toBe("INSERT INTO t (a, b) VALUES (?, ?), (?, ?)");
		expect(stmt.params).toEqual([1, 2, 3, 4]);
	});

	it("rows 빈 배열 → throw", () => {
		expect(() => multiInsert("t", ["a"], [])).toThrow(/no rows for table t/);
	});

	it("row length ≠ columns length → throw", () => {
		expect(() => multiInsert("t", ["a", "b"], [[1, 2], [3]])).toThrow(/row length 1 ≠ 2/);
	});

	it("1 row 도 정상", () => {
		const stmt = multiInsert("t", ["x"], [[42]]);
		expect(stmt.sql).toBe("INSERT INTO t (x) VALUES (?)");
		expect(stmt.params).toEqual([42]);
	});
});

describe("inClause", () => {
	it("정상 — 3 values", () => {
		const c = inClause(["a", "b", "c"]);
		expect(c.placeholders).toBe("(?, ?, ?)");
		expect(c.params).toEqual(["a", "b", "c"]);
	});

	it("빈 배열 → (NULL) (SQL valid no-match)", () => {
		const c = inClause([]);
		expect(c.placeholders).toBe("(NULL)");
		expect(c.params).toEqual([]);
	});

	it("1 value", () => {
		const c = inClause([42]);
		expect(c.placeholders).toBe("(?)");
		expect(c.params).toEqual([42]);
	});
});
