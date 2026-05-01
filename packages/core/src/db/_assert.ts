// ============================================================
// 테스트 공용 assertion 헬퍼
// 모든 e2e 스크립트에서 import — 통계·실패 출력·equality 헬퍼 통합.
// ============================================================

let _pass = 0;
let _fail = 0;
const _failures: string[] = [];

export function assert(cond: boolean, label: string): void {
	if (cond) {
		console.log(`  ✓ ${label}`);
		_pass++;
	} else {
		console.log(`  ✗ ${label}`);
		_fail++;
		_failures.push(label);
	}
}

export function assertEq<T>(actual: T, expected: T, label: string): void {
	const ok = actual === expected;
	if (ok) {
		console.log(`  ✓ ${label}  →  ${String(actual)}`);
		_pass++;
	} else {
		console.log(`  ✗ ${label}  →  expected ${String(expected)}, got ${String(actual)}`);
		_fail++;
		_failures.push(`${label} (expected ${String(expected)}, got ${String(actual)})`);
	}
}

/** 부동소수점 비교 — ELO 계산 등. */
export function assertNear(actual: number, expected: number, eps: number, label: string): void {
	const ok = Math.abs(actual - expected) < eps;
	if (ok) {
		console.log(`  ✓ ${label}  →  ${actual.toFixed(3)} (≈ ${expected})`);
		_pass++;
	} else {
		console.log(`  ✗ ${label}  →  expected ≈${expected} (±${eps}), got ${actual.toFixed(3)}`);
		_fail++;
		_failures.push(`${label} (expected ≈${expected}, got ${actual.toFixed(3)})`);
	}
}

export function section(label: string): void {
	console.log(`\n[${label}]`);
}

export function summary(): { pass: number; fail: number } {
	return { pass: _pass, fail: _fail };
}

export function exitBasedOnSummary(): void {
	const { pass, fail } = summary();
	if (fail > 0) {
		console.log(`\n[FAIL] ${pass} passed, ${fail} failed`);
		console.log("실패 항목:");
		for (const f of _failures) console.log(`  - ${f}`);
		process.exit(1);
	}
	console.log(`\n[OK] ${pass} passed, 0 failed`);
	process.exit(0);
}
