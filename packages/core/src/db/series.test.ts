import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, installDbDriver, type TestDb } from "../test-utils/db-harness.js";

import { createSeason } from "./seasons.js";
import {
	cancelSeries,
	completeSeries,
	createSeries,
	getSeries,
	getSeriesParticipants,
	listAllOpenSeries,
	listOpenSeriesByUser,
	listRecentSeriesForUser,
	listSeries,
	listStaleOpenSeries,
	setSeriesMessage,
	softDeleteSeries,
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

	it("listSeries — status / seasonId / limit 필터", async () => {
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

		// 전체 — 최신순
		const all = await listSeries({});
		expect(all.map((s) => s.id)).toEqual([s3.id, s2.id, s1.id]);

		// status 필터
		const inProgress = await listSeries({ status: "IN_PROGRESS" });
		expect(inProgress.map((s) => s.id)).toEqual([s1.id]);
		const completed = await listSeries({ status: "COMPLETED" });
		expect(completed.map((s) => s.id)).toEqual([s2.id]);

		// limit
		const limited = await listSeries({ limit: 2 });
		expect(limited).toHaveLength(2);

		// seasonId 필터 (현재 시즌만 시리즈 있음)
		const wrongSeason = await listSeries({ seasonId: 999 });
		expect(wrongSeason).toEqual([]);
		const correctSeason = await listSeries({ seasonId });
		expect(correctSeason).toHaveLength(3);
	});

	it("listSeries 가 soft-deleted 시리즈 제외 (status 필터 유/무 모두)", async () => {
		const make = (uid1: string, uid2: string) =>
			createSeries({
				seasonId,
				createdBy: OP,
				participants: [
					{ userId: uid1, team: "TEAM_1", role: "TOP" },
					{ userId: uid2, team: "TEAM_2", role: "TOP" },
				],
			});
		const live = await make("u1", "u2");
		const completedLive = await make("u3", "u4");
		await completeSeries(completedLive.id, "TEAM_1");
		const gone = await make("u1", "u3");
		const completedGone = await make("u2", "u4");
		await completeSeries(completedGone.id, "TEAM_2");
		await softDeleteSeries(gone.id);
		await softDeleteSeries(completedGone.id);

		const all = await listSeries({});
		expect(all.map((s) => s.id).sort()).toEqual([live.id, completedLive.id].sort());

		const inProgress = await listSeries({ status: "IN_PROGRESS" });
		expect(inProgress.map((s) => s.id)).toEqual([live.id]);

		const completed = await listSeries({ status: "COMPLETED" });
		expect(completed.map((s) => s.id)).toEqual([completedLive.id]);

		const seasoned = await listSeries({ seasonId });
		expect(seasoned.map((s) => s.id).sort()).toEqual([live.id, completedLive.id].sort());
	});
});

describe("softDeleteSeries", () => {
	it("series 가 read 쿼리에서 가려지고 같은 id 로 createSeries 시 revive", async () => {
		const s = await createSeries({
			seasonId,
			createdBy: OP,
			participants: [
				{ userId: "u1", team: "TEAM_1", role: "TOP" },
				{ userId: "u2", team: "TEAM_2", role: "TOP" },
			],
		});
		expect(await getSeriesParticipants(s.id)).toHaveLength(2);

		await softDeleteSeries(s.id);

		// soft-delete: getSeries 는 가려주지만 row 는 남음
		expect(await getSeries(s.id)).toBeUndefined();
		// 참가자도 그대로 (cleanup 은 createSeries revive 가 처리)
		expect(await getSeriesParticipants(s.id)).toHaveLength(2);

		// 같은 id 로 createSeries 호출 → revive (참가자 교체)
		const revived = await createSeries({
			id: s.id,
			seasonId,
			createdBy: OP,
			participants: [
				{ userId: "u3", team: "TEAM_1", role: "MID" },
				{ userId: "u4", team: "TEAM_2", role: "MID" },
			],
		});
		expect(revived.id).toBe(s.id);
		const after = await getSeries(s.id);
		expect(after?.deleted_at).toBeNull();
		expect(after?.status).toBe("IN_PROGRESS");
		const parts = await getSeriesParticipants(s.id);
		expect(parts).toHaveLength(2);
		expect(new Set(parts.map((p) => p.user_id))).toEqual(new Set(["u3", "u4"]));
	});

	it("force-delete 된 historical 시리즈 (games > 0) 는 같은 id 로 revive 거부", async () => {
		// invariant: 게임이 1개라도 기록된 시리즈는 soft-delete 이후에도 revive 불가.
		// 깨지면 orphan games/mmr_changes 가 새 시리즈에 attach 되어 corruption.
		const s = await createSeries({
			id: 21,
			seasonId,
			createdBy: OP,
			participants: [
				{ userId: "u1", team: "TEAM_1", role: "TOP" },
				{ userId: "u2", team: "TEAM_2", role: "TOP" },
			],
		});
		// 게임 1개 기록 후 force-delete (soft-delete)
		db
			.prepare(
				`INSERT INTO games (ranked_series_id, game_number, winning_team, team1_side, duration_sec)
			 VALUES (?, 1, 'TEAM_1', 'BLUE', 1800)`,
			)
			.run(s.id);
		await softDeleteSeries(s.id);
		expect(await getSeries(s.id)).toBeUndefined();

		await expect(
			createSeries({
				id: 21,
				seasonId,
				createdBy: OP,
				participants: [
					{ userId: "u3", team: "TEAM_1", role: "MID" },
					{ userId: "u4", team: "TEAM_2", role: "MID" },
				],
			}),
		).rejects.toThrow(/이미 존재/);

		// 원본 row 와 게임은 그대로 남아 있어야 함 (history 보존).
		const row = db.prepare("SELECT id, status, deleted_at FROM series WHERE id = ?").get(s.id) as {
			id: number;
			status: string;
			deleted_at: number | null;
		};
		expect(row.deleted_at).not.toBeNull();
		const gameCount = db
			.prepare("SELECT COUNT(*) AS n FROM games WHERE ranked_series_id = ?")
			.get(s.id) as { n: number };
		expect(gameCount.n).toBe(1);
	});
});

describe("createSeries — 명시 id", () => {
	it("명시 id 로 INSERT — 모집 ID 매칭 흐름", async () => {
		const s = await createSeries({
			id: 42,
			seasonId,
			createdBy: OP,
			participants: [
				{ userId: "u1", team: "TEAM_1", role: "TOP" },
				{ userId: "u2", team: "TEAM_2", role: "TOP" },
			],
		});
		expect(s.id).toBe(42);
	});

	it("같은 id 의 살아있는 행이 있으면 에러", async () => {
		await createSeries({
			id: 7,
			seasonId,
			createdBy: OP,
			participants: [
				{ userId: "u1", team: "TEAM_1", role: "TOP" },
				{ userId: "u2", team: "TEAM_2", role: "TOP" },
			],
		});
		await expect(
			createSeries({
				id: 7,
				seasonId,
				createdBy: OP,
				participants: [
					{ userId: "u3", team: "TEAM_1", role: "MID" },
					{ userId: "u4", team: "TEAM_2", role: "MID" },
				],
			}),
		).rejects.toThrow(/이미 존재/);
	});

	it("game 0 + CANCELLED 행은 revive (참가자 교체) — revert 후 재확정 흐름", async () => {
		const s = await createSeries({
			id: 9,
			seasonId,
			createdBy: OP,
			participants: [
				{ userId: "u1", team: "TEAM_1", role: "TOP" },
				{ userId: "u2", team: "TEAM_2", role: "TOP" },
			],
		});
		await cancelSeries(s.id);

		const revived = await createSeries({
			id: 9,
			seasonId,
			createdBy: OP,
			participants: [
				{ userId: "u3", team: "TEAM_1", role: "MID" },
				{ userId: "u4", team: "TEAM_2", role: "MID" },
			],
		});
		expect(revived.id).toBe(9);
		const after = await getSeries(9);
		expect(after?.status).toBe("IN_PROGRESS");
		expect(after?.deleted_at).toBeNull();
		const parts = await getSeriesParticipants(9);
		expect(new Set(parts.map((p) => p.user_id))).toEqual(new Set(["u3", "u4"]));
	});

	it("게임이 1개라도 있는 CANCELLED 행은 revive 거부 (history 보존)", async () => {
		const s = await createSeries({
			id: 11,
			seasonId,
			createdBy: OP,
			participants: [
				{ userId: "u1", team: "TEAM_1", role: "TOP" },
				{ userId: "u2", team: "TEAM_2", role: "TOP" },
			],
		});
		// 게임 1개 기록 후 CANCEL (early-complete 시나리오)
		db
			.prepare(
				`INSERT INTO games (ranked_series_id, game_number, winning_team, team1_side, duration_sec)
			 VALUES (?, 1, 'TEAM_1', 'BLUE', 1800)`,
			)
			.run(s.id);
		await cancelSeries(s.id);

		await expect(
			createSeries({
				id: 11,
				seasonId,
				createdBy: OP,
				participants: [
					{ userId: "u3", team: "TEAM_1", role: "MID" },
					{ userId: "u4", team: "TEAM_2", role: "MID" },
				],
			}),
		).rejects.toThrow(/이미 존재/);
	});

	it("COMPLETED 행은 revive 거부", async () => {
		const s = await createSeries({
			id: 13,
			seasonId,
			createdBy: OP,
			participants: [
				{ userId: "u1", team: "TEAM_1", role: "TOP" },
				{ userId: "u2", team: "TEAM_2", role: "TOP" },
			],
		});
		await completeSeries(s.id, "TEAM_1");
		await expect(
			createSeries({
				id: 13,
				seasonId,
				createdBy: OP,
				participants: [
					{ userId: "u3", team: "TEAM_1", role: "MID" },
					{ userId: "u4", team: "TEAM_2", role: "MID" },
				],
			}),
		).rejects.toThrow(/이미 존재/);
	});

	// v0.11.0: cross-type hijack 테스트 제거 — series 가 RANKED 전용이 되면서
	// 구조적으로 AUCTION 행이 series 테이블에 존재할 수 없음.
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
