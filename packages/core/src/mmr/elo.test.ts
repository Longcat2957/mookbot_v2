import { describe, expect, it } from "vitest";
import {
	applyGameElo,
	expectedScore,
	K_FACTOR,
	type LaneMatchup,
	type Role,
	updateElo,
} from "./elo.js";

describe("expectedScore", () => {
	it("equal MMR → 0.5", () => {
		expect(expectedScore(1500, 1500)).toBeCloseTo(0.5, 5);
	});

	it("400 above → ~0.909 (10:1 odds)", () => {
		expect(expectedScore(1900, 1500)).toBeCloseTo(0.909, 2);
	});

	it("400 below → ~0.091", () => {
		expect(expectedScore(1100, 1500)).toBeCloseTo(0.091, 2);
	});

	it("symmetric: f(a,b) + f(b,a) = 1", () => {
		expect(expectedScore(1500, 1700) + expectedScore(1700, 1500)).toBeCloseTo(1, 5);
	});
});

describe("updateElo", () => {
	it("win at equal MMR → +K/2", () => {
		const r = updateElo(1500, 1500, true);
		expect(r.delta).toBeCloseTo(K_FACTOR / 2, 5);
		expect(r.mmrBefore).toBe(1500);
		expect(r.mmrAfter).toBeCloseTo(1500 + K_FACTOR / 2, 5);
	});

	it("loss at equal MMR → -K/2", () => {
		const r = updateElo(1500, 1500, false);
		expect(r.delta).toBeCloseTo(-K_FACTOR / 2, 5);
	});

	it("upset (lower wins) → big positive delta", () => {
		const r = updateElo(1100, 1900, true);
		expect(r.delta).toBeGreaterThan(K_FACTOR * 0.9);
	});

	it("expected (higher wins) → small positive delta", () => {
		const r = updateElo(1900, 1100, true);
		expect(r.delta).toBeLessThan(K_FACTOR * 0.1);
		expect(r.delta).toBeGreaterThan(0);
	});

	it("custom K argument honored", () => {
		const r = updateElo(1500, 1500, true, 10);
		expect(r.delta).toBeCloseTo(5, 5);
	});

	it("zero-sum across opposing players", () => {
		const win = updateElo(1500, 1700, true);
		const loss = updateElo(1700, 1500, false);
		expect(win.delta).toBeCloseTo(-loss.delta, 5);
	});
});

describe("applyGameElo", () => {
	const roles: Role[] = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"];
	const equalMatchups: LaneMatchup[] = roles.map((role, i) => ({
		role,
		team1: { userId: `t1-${i}`, mmr: 1500 },
		team2: { userId: `t2-${i}`, mmr: 1500 },
	}));

	it("returns one result per lane", () => {
		const out = applyGameElo(equalMatchups, "TEAM_1");
		expect(out).toHaveLength(5);
	});

	it("TEAM_1 win at equal MMR → all team1 +K/2, all team2 -K/2", () => {
		const out = applyGameElo(equalMatchups, "TEAM_1");
		for (const r of out) {
			expect(r.team1.delta).toBeCloseTo(K_FACTOR / 2, 5);
			expect(r.team2.delta).toBeCloseTo(-K_FACTOR / 2, 5);
		}
	});

	it("zero-sum invariant: sum(deltas) = 0", () => {
		const out = applyGameElo(equalMatchups, "TEAM_2");
		const total = out.reduce((s, r) => s + r.team1.delta + r.team2.delta, 0);
		expect(total).toBeCloseTo(0, 5);
	});

	it("preserves role order and userId mapping", () => {
		const out = applyGameElo(equalMatchups, "TEAM_1");
		expect(out.map((r) => r.role)).toEqual(roles);
		expect(out[0]?.team1.userId).toBe("t1-0");
		expect(out[0]?.team1.opponentId).toBe("t2-0");
		expect(out[0]?.team2.userId).toBe("t2-0");
		expect(out[0]?.team2.opponentId).toBe("t1-0");
	});

	it("uneven MMR matchup — winner gain less if higher rated", () => {
		const m: LaneMatchup[] = [
			{ role: "MID", team1: { userId: "a", mmr: 1800 }, team2: { userId: "b", mmr: 1200 } },
		];
		const out = applyGameElo(m, "TEAM_1");
		expect(out[0]?.team1.delta).toBeLessThan(K_FACTOR * 0.2);
		expect(out[0]?.team2.delta).toBeGreaterThan(-K_FACTOR * 0.2);
	});
});
