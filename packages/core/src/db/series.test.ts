import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, installDbDriver, type TestDb } from "../test-utils/db-harness.js";

import { createSeason } from "./seasons.js";
import {
	cancelSeries,
	completeSeries,
	createSeries,
	deleteSeriesPhysical,
	getSeries,
	getSeriesParticipants,
	listAllOpenSeries,
	listOpenSeriesByUser,
	listRecentSeriesForUser,
	listStaleOpenSeries,
	setSeriesMessage,
} from "./series.js";
import { upsertUser } from "./users.js";

let db: TestDb;
let seasonId: number;
const OP = "op-id";

beforeEach(async () => {
	db = createTestDb();
	installDbDriver(db);
	const s = await createSeason("Test");
	seasonId = s.id;
	await upsertUser(OP, "Operator");
	for (const id of ["u1", "u2", "u3", "u4"]) await upsertUser(id, id);
});

describe("createSeries", () => {
	it("happy path 2v2 (ELO 매치업 가능)", async () => {
		const series = await createSeries({
			seasonId,
			createdBy: OP,
			participants: [
				{ userId: "u1", team: "TEAM_1", role: "TOP" },
				{ userId: "u2", team: "TEAM_1", role: "MID" },
				{ userId: "u3", team: "TEAM_2", role: "TOP" },
				{ userId: "u4", team: "TEAM_2", role: "MID" },
			],
		});
		expect(series.id).toBeGreaterThan(0);
		expect(series.status).toBe("IN_PROGRESS");
		expect(series.season_id).toBe(seasonId);

		const parts = await getSeriesParticipants(series.id);
		expect(parts).toHaveLength(4);
		expect(new Set(parts.map((p) => p.role))).toEqual(new Set(["TOP", "MID"]));
	});

	it("rejects 홀수 참가자", async () => {
		await expect(
			createSeries({
				seasonId,
				createdBy: OP,
				participants: [
					{ userId: "u1", team: "TEAM_1", role: "TOP" },
					{ userId: "u2", team: "TEAM_2", role: "TOP" },
					{ userId: "u3", team: "TEAM_2", role: "MID" },
				],
			}),
		).rejects.toThrow(/짝수/);
	});

	it("rejects 팀 크기 불일치", async () => {
		await expect(
			createSeries({
				seasonId,
				createdBy: OP,
				participants: [
					{ userId: "u1", team: "TEAM_1", role: "TOP" },
					{ userId: "u2", team: "TEAM_1", role: "MID" },
					{ userId: "u3", team: "TEAM_2", role: "TOP" },
					{ userId: "u4", team: "TEAM_2", role: "TOP" },
				],
			}),
		).rejects.toThrow(/TEAM_1 내 라인 중복|TEAM_2 내 라인 중복|매치업/);
	});

	it("rejects TEAM_1 내 라인 중복", async () => {
		await expect(
			createSeries({
				seasonId,
				createdBy: OP,
				participants: [
					{ userId: "u1", team: "TEAM_1", role: "TOP" },
					{ userId: "u2", team: "TEAM_1", role: "TOP" },
					{ userId: "u3", team: "TEAM_2", role: "TOP" },
					{ userId: "u4", team: "TEAM_2", role: "MID" },
				],
			}),
		).rejects.toThrow(/TEAM_1 내 라인 중복/);
	});

	it("rejects TEAM_2 내 라인 중복", async () => {
		await expect(
			createSeries({
				seasonId,
				createdBy: OP,
				participants: [
					{ userId: "u1", team: "TEAM_1", role: "TOP" },
					{ userId: "u2", team: "TEAM_1", role: "MID" },
					{ userId: "u3", team: "TEAM_2", role: "TOP" },
					{ userId: "u4", team: "TEAM_2", role: "TOP" },
				],
			}),
		).rejects.toThrow(/TEAM_2 내 라인 중복/);
	});

	it("rejects 라인 매치업 없음", async () => {
		await expect(
			createSeries({
				seasonId,
				createdBy: OP,
				participants: [
					{ userId: "u1", team: "TEAM_1", role: "TOP" },
					{ userId: "u2", team: "TEAM_2", role: "MID" },
				],
			}),
		).rejects.toThrow(/매치업/);
	});
});

describe("status transitions", () => {
	async function mkSeries() {
		return createSeries({
			seasonId,
			createdBy: OP,
			participants: [
				{ userId: "u1", team: "TEAM_1", role: "TOP" },
				{ userId: "u2", team: "TEAM_2", role: "TOP" },
			],
		});
	}

	it("completeSeries 가 winning_team + ended_at 설정", async () => {
		const s = await mkSeries();
		await completeSeries(s.id, "TEAM_1");
		const after = await getSeries(s.id);
		expect(after?.status).toBe("COMPLETED");
		expect(after?.winning_team).toBe("TEAM_1");
		expect(after?.ended_at).toBeGreaterThan(0);
	});

	it("completeSeries no-op on non-IN_PROGRESS", async () => {
		const s = await mkSeries();
		await completeSeries(s.id, "TEAM_1");
		await completeSeries(s.id, "TEAM_2"); // 두 번째 호출은 무시
		const after = await getSeries(s.id);
		expect(after?.winning_team).toBe("TEAM_1");
	});

	it("cancelSeries 가 status=CANCELLED", async () => {
		const s = await mkSeries();
		await cancelSeries(s.id);
		const after = await getSeries(s.id);
		expect(after?.status).toBe("CANCELLED");
		expect(after?.winning_team).toBeNull();
	});
});

describe("listing", () => {
	it("listAllOpenSeries 가 COMPLETED/CANCELLED 제외", async () => {
		const make = (uid1: string, uid2: string) =>
			createSeries({
				seasonId,
				createdBy: OP,
				participants: [
					{ userId: uid1, team: "TEAM_1", role: "TOP" },
					{ userId: uid2, team: "TEAM_2", role: "TOP" },
				],
			});
		const s1 = await make("u1", "u2");
		const s2 = await make("u3", "u4");
		const s3 = await make("u1", "u3");

		await completeSeries(s2.id, "TEAM_1");
		await cancelSeries(s3.id);

		const open = await listAllOpenSeries();
		expect(open.map((s) => s.id)).toEqual([s1.id]);
	});

	it("listStaleOpenSeries 가 cutoff 이전만 반환", async () => {
		const fresh = await createSeries({
			seasonId,
			createdBy: OP,
			participants: [
				{ userId: "u1", team: "TEAM_1", role: "TOP" },
				{ userId: "u2", team: "TEAM_2", role: "TOP" },
			],
		});
		// fresh.started_at + 1 = future cutoff → 결과 없음
		const futureCutoff = fresh.started_at - 1;
		expect(await listStaleOpenSeries(futureCutoff)).toEqual([]);
		// pastCutoff +1 = include
		const pastCutoff = fresh.started_at + 1;
		const stale = await listStaleOpenSeries(pastCutoff);
		expect(stale.map((s) => s.id)).toContain(fresh.id);
	});
});

describe("deleteSeriesPhysical", () => {
	it("CASCADE 로 series_participants 정리", async () => {
		const s = await createSeries({
			seasonId,
			createdBy: OP,
			participants: [
				{ userId: "u1", team: "TEAM_1", role: "TOP" },
				{ userId: "u2", team: "TEAM_2", role: "TOP" },
			],
		});
		expect(await getSeriesParticipants(s.id)).toHaveLength(2);

		await deleteSeriesPhysical(s.id);

		expect(await getSeries(s.id)).toBeUndefined();
		expect(await getSeriesParticipants(s.id)).toEqual([]);
	});
});

describe("setSeriesMessage / listOpenSeriesByUser / listRecentSeriesForUser", () => {
	async function mk(uid1: string, uid2: string) {
		return createSeries({
			seasonId,
			createdBy: OP,
			participants: [
				{ userId: uid1, team: "TEAM_1", role: "TOP" },
				{ userId: uid2, team: "TEAM_2", role: "TOP" },
			],
		});
	}

	it("setSeriesMessage 가 channel/message 저장", async () => {
		const s = await mk("u1", "u2");
		await setSeriesMessage(s.id, "ch-1", "msg-1");
		const after = await getSeries(s.id);
		expect(after?.channel_id).toBe("ch-1");
		expect(after?.message_id).toBe("msg-1");
	});

	it("listOpenSeriesByUser — 참가자 본인의 IN_PROGRESS 만", async () => {
		const s1 = await mk("u1", "u2");
		const s2 = await mk("u3", "u4");
		await completeSeries(s1.id, "TEAM_1"); // s1 닫힘
		const list = await listOpenSeriesByUser("u3");
		expect(list.map((s) => s.id)).toEqual([s2.id]);
	});

	it("listRecentSeriesForUser — 참가/운영 모두, 모든 status", async () => {
		const s1 = await mk("u1", "u2");
		const s2 = await mk("u3", "u4");
		await cancelSeries(s2.id);
		// op (createdBy) 도 본인이 만든 시리즈 모두 보임
		const opList = await listRecentSeriesForUser(OP);
		expect(opList.map((s) => s.id).sort()).toEqual([s1.id, s2.id].sort());
	});
});
