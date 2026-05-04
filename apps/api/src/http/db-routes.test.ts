// Wave 5.x — DB-touching api 라우트 통합 테스트.
// d1 driver pattern (in-memory SQLite) 위에서 라우트 핸들러 풀스택 실행.
//
// datadragon 은 미모킹 — getChampionName(N) → "Unknown(N)" 으로 fallback.
// 테스트는 챔프 이름 자체보다 구조/사이드이펙트 (DB row, status code) 를 검증.

import { __resetDriver, type TestDb } from "@mookbot/core/test-utils/db-harness";
import { afterEach, describe, expect, it } from "vitest";
import { buildTestApp, signSid } from "../test-utils/build-app.js";

afterEach(() => {
	__resetDriver();
});

const OP = "operator-uid";

interface Fixture {
	seasonId: number;
	recruitmentId: number;
}

function seedRecruitment(db: TestDb, status: "OPEN" | "CLOSED" | "CONVERTED" = "CLOSED"): Fixture {
	const seasonId = (
		db
			.prepare("INSERT INTO seasons (name, started_at) VALUES (?, unixepoch()) RETURNING id")
			.get("Test") as { id: number }
	).id;
	for (const id of [OP, "u1", "u2"]) {
		db.prepare("INSERT INTO users (discord_id, display_name) VALUES (?, ?)").run(id, id);
	}
	const recId = (
		db
			.prepare(
				`INSERT INTO recruitments (season_id, target_count, created_by, status) VALUES (?, 2, ?, ?) RETURNING id`,
			)
			.get(seasonId, OP, status) as { id: number }
	).id;
	return { seasonId, recruitmentId: recId };
}

describe("POST /api/series", () => {
	it("CLOSED 모집 → series 생성 + 모집 status CONVERTED", async () => {
		const { app, db } = await buildTestApp({ canEdit: true });
		const { recruitmentId } = seedRecruitment(db, "CLOSED");

		const res = await app.inject({
			method: "POST",
			url: "/api/series",
			cookies: { sid: signSid(app, OP) },
			payload: {
				recruitmentId,
				assignments: [
					{ userId: "u1", team: "TEAM_1", role: "TOP" },
					{ userId: "u2", team: "TEAM_2", role: "TOP" },
				],
			},
		});

		expect(res.statusCode).toBe(200);
		const { seriesId } = res.json() as { seriesId: number };
		expect(seriesId).toBeGreaterThan(0);

		const recAfter = db
			.prepare("SELECT status, converted_series_id FROM recruitments WHERE id = ?")
			.get(recruitmentId) as { status: string; converted_series_id: number };
		expect(recAfter.status).toBe("CONVERTED");
		expect(recAfter.converted_series_id).toBe(seriesId);

		const series = db.prepare("SELECT * FROM series WHERE id = ?").get(seriesId) as {
			status: string;
		};
		expect(series.status).toBe("IN_PROGRESS");
	});

	it("recruitment not found → 404", async () => {
		const { app } = await buildTestApp({ canEdit: true });
		const res = await app.inject({
			method: "POST",
			url: "/api/series",
			cookies: { sid: signSid(app, OP) },
			payload: { recruitmentId: 99999, assignments: [] },
		});
		expect(res.statusCode).toBe(404);
	});

	it("이미 CONVERTED 모집 → 409", async () => {
		const { app, db } = await buildTestApp({ canEdit: true });
		const { recruitmentId } = seedRecruitment(db, "CONVERTED");
		const res = await app.inject({
			method: "POST",
			url: "/api/series",
			cookies: { sid: signSid(app, OP) },
			payload: {
				recruitmentId,
				assignments: [
					{ userId: "u1", team: "TEAM_1", role: "TOP" },
					{ userId: "u2", team: "TEAM_2", role: "TOP" },
				],
			},
		});
		expect(res.statusCode).toBe(409);
	});
});

describe("GET /api/series", () => {
	it("IN_PROGRESS 시리즈 listing + 참가자", async () => {
		const { app, db } = await buildTestApp();
		const { seasonId } = seedRecruitment(db);
		const sid = (
			db
				.prepare("INSERT INTO series (season_id, created_by) VALUES (?, ?) RETURNING id")
				.get(seasonId, OP) as { id: number }
		).id;
		db
			.prepare(
				"INSERT INTO series_participants (series_id, user_id, team, role) VALUES (?, ?, 'TEAM_1', 'TOP')",
			)
			.run(sid, "u1");
		db
			.prepare(
				"INSERT INTO series_participants (series_id, user_id, team, role) VALUES (?, ?, 'TEAM_2', 'TOP')",
			)
			.run(sid, "u2");

		const res = await app.inject({
			method: "GET",
			url: "/api/series",
			cookies: { sid: signSid(app, OP) },
		});
		expect(res.statusCode).toBe(200);
		const { series } = res.json() as { series: { id: number; participants: unknown[] }[] };
		expect(series).toHaveLength(1);
		expect(series[0]?.id).toBe(sid);
		expect(series[0]?.participants).toHaveLength(2);
	});

	it("빈 리스트 → []", async () => {
		const { app } = await buildTestApp();
		const res = await app.inject({
			method: "GET",
			url: "/api/series",
			cookies: { sid: signSid(app, OP) },
		});
		expect(res.json()).toEqual({ series: [] });
	});
});

describe("GET /api/series/:id", () => {
	async function setupSeries() {
		const { app, db } = await buildTestApp();
		const { seasonId } = seedRecruitment(db);
		const sid = (
			db
				.prepare("INSERT INTO series (season_id, created_by) VALUES (?, ?) RETURNING id")
				.get(seasonId, OP) as { id: number }
		).id;
		db
			.prepare(
				"INSERT INTO series_participants (series_id, user_id, team, role) VALUES (?, ?, 'TEAM_1', 'TOP')",
			)
			.run(sid, "u1");
		db
			.prepare(
				"INSERT INTO series_participants (series_id, user_id, team, role) VALUES (?, ?, 'TEAM_2', 'TOP')",
			)
			.run(sid, "u2");
		return { app, db, seriesId: sid };
	}

	it("series + participants + games + pickbanDraft 반환", async () => {
		const { app, seriesId } = await setupSeries();
		const res = await app.inject({
			method: "GET",
			url: `/api/series/${seriesId}`,
			cookies: { sid: signSid(app, OP) },
		});
		expect(res.statusCode).toBe(200);
		const body = res.json() as {
			series: { id: number; status: string };
			participants: unknown[];
			games: unknown[];
			pickbanDraft: unknown;
		};
		expect(body.series.id).toBe(seriesId);
		expect(body.series.status).toBe("IN_PROGRESS");
		expect(body.participants).toHaveLength(2);
		expect(body.games).toEqual([]);
		expect(body.pickbanDraft).toBeNull();
	});

	it("invalid id → 400", async () => {
		const { app } = await buildTestApp();
		const res = await app.inject({
			method: "GET",
			url: "/api/series/abc",
			cookies: { sid: signSid(app, OP) },
		});
		expect(res.statusCode).toBe(400);
	});

	it("not found → 404", async () => {
		const { app } = await buildTestApp();
		const res = await app.inject({
			method: "GET",
			url: "/api/series/99999",
			cookies: { sid: signSid(app, OP) },
		});
		expect(res.statusCode).toBe(404);
	});
});

describe("PUT /api/series/:id/pickban (draft)", () => {
	it("draft 저장 + GET 으로 복원", async () => {
		const { app, db } = await buildTestApp({ canEdit: true });
		const { seasonId } = seedRecruitment(db);
		const sid = (
			db
				.prepare("INSERT INTO series (season_id, created_by) VALUES (?, ?) RETURNING id")
				.get(seasonId, OP) as { id: number }
		).id;
		db
			.prepare(
				"INSERT INTO series_participants (series_id, user_id, team, role) VALUES (?, ?, 'TEAM_1', 'TOP')",
			)
			.run(sid, "u1");
		db
			.prepare(
				"INSERT INTO series_participants (series_id, user_id, team, role) VALUES (?, ?, 'TEAM_2', 'TOP')",
			)
			.run(sid, "u2");

		const draft = { games: [{ gameNumber: 1, team1Side: "BLUE" }], currentGame: 1 };
		const put = await app.inject({
			method: "PUT",
			url: `/api/series/${sid}/pickban`,
			cookies: { sid: signSid(app, OP) },
			payload: draft,
		});
		expect(put.statusCode).toBe(200);

		const get = await app.inject({
			method: "GET",
			url: `/api/series/${sid}`,
			cookies: { sid: signSid(app, OP) },
		});
		const body = get.json() as { pickbanDraft: typeof draft };
		expect(body.pickbanDraft).toEqual(draft);
	});
});

describe("POST /api/series/:id/games (record + Bo3)", () => {
	async function setupSeries() {
		const { app, db } = await buildTestApp({ canEdit: true });
		const { seasonId } = seedRecruitment(db);
		const sid = (
			db
				.prepare("INSERT INTO series (season_id, created_by) VALUES (?, ?) RETURNING id")
				.get(seasonId, OP) as { id: number }
		).id;
		db
			.prepare(
				"INSERT INTO series_participants (series_id, user_id, team, role) VALUES (?, ?, 'TEAM_1', 'TOP')",
			)
			.run(sid, "u1");
		db
			.prepare(
				"INSERT INTO series_participants (series_id, user_id, team, role) VALUES (?, ?, 'TEAM_2', 'TOP')",
			)
			.run(sid, "u2");
		return { app, db, seriesId: sid, seasonId };
	}

	function gamePayload(gameNumber: 1 | 2, winningTeam: "TEAM_1" | "TEAM_2") {
		return {
			gameNumber,
			team1Side: "BLUE",
			winningTeam,
			picks: {
				TEAM_1: [{ role: "TOP", championId: 1 }],
				TEAM_2: [{ role: "TOP", championId: 2 }],
			},
			bans: { TEAM_1: [], TEAM_2: [] },
		};
	}

	it("game 1 기록 → Bo3 미종료 (1-0)", async () => {
		const { app, db, seriesId } = await setupSeries();
		const res = await app.inject({
			method: "POST",
			url: `/api/series/${seriesId}/games`,
			cookies: { sid: signSid(app, OP) },
			payload: gamePayload(1, "TEAM_1"),
		});
		expect(res.statusCode).toBe(200);
		const body = res.json() as { wins: { team1: number; team2: number }; completed: boolean };
		expect(body.wins).toEqual({ team1: 1, team2: 0 });
		expect(body.completed).toBe(false);

		const series = db.prepare("SELECT status FROM series WHERE id = ?").get(seriesId) as {
			status: string;
		};
		expect(series.status).toBe("IN_PROGRESS");
	});

	it("game 2 = TEAM_1 두 번째 승 → Bo3 자동 COMPLETED (2-0)", async () => {
		const { app, db, seriesId } = await setupSeries();
		await app.inject({
			method: "POST",
			url: `/api/series/${seriesId}/games`,
			cookies: { sid: signSid(app, OP) },
			payload: gamePayload(1, "TEAM_1"),
		});
		const res2 = await app.inject({
			method: "POST",
			url: `/api/series/${seriesId}/games`,
			cookies: { sid: signSid(app, OP) },
			payload: gamePayload(2, "TEAM_1"),
		});
		const body = res2.json() as { wins: { team1: number; team2: number }; completed: boolean };
		expect(body.wins).toEqual({ team1: 2, team2: 0 });
		expect(body.completed).toBe(true);

		const series = db
			.prepare("SELECT status, winning_team FROM series WHERE id = ?")
			.get(seriesId) as { status: string; winning_team: string };
		expect(series.status).toBe("COMPLETED");
		expect(series.winning_team).toBe("TEAM_1");
	});

	it("Game N 의 N-1 미완료 → 409", async () => {
		const { app, seriesId } = await setupSeries();
		const res = await app.inject({
			method: "POST",
			url: `/api/series/${seriesId}/games`,
			cookies: { sid: signSid(app, OP) },
			payload: gamePayload(2, "TEAM_1"),
		});
		expect(res.statusCode).toBe(409);
	});

	it("같은 gameNumber 중복 기록 → 409", async () => {
		const { app, seriesId } = await setupSeries();
		await app.inject({
			method: "POST",
			url: `/api/series/${seriesId}/games`,
			cookies: { sid: signSid(app, OP) },
			payload: gamePayload(1, "TEAM_1"),
		});
		const res = await app.inject({
			method: "POST",
			url: `/api/series/${seriesId}/games`,
			cookies: { sid: signSid(app, OP) },
			payload: gamePayload(1, "TEAM_2"),
		});
		expect(res.statusCode).toBe(409);
	});
});

describe("DELETE /api/series/:id/games/last", () => {
	it("최근 게임 삭제 + MMR 차감", async () => {
		const { app, db } = await buildTestApp({ canEdit: true });
		const { seasonId } = seedRecruitment(db);
		const sid = (
			db
				.prepare("INSERT INTO series (season_id, created_by) VALUES (?, ?) RETURNING id")
				.get(seasonId, OP) as { id: number }
		).id;
		db
			.prepare(
				"INSERT INTO series_participants (series_id, user_id, team, role) VALUES (?, ?, 'TEAM_1', 'TOP')",
			)
			.run(sid, "u1");
		db
			.prepare(
				"INSERT INTO series_participants (series_id, user_id, team, role) VALUES (?, ?, 'TEAM_2', 'TOP')",
			)
			.run(sid, "u2");

		// game 1 기록
		await app.inject({
			method: "POST",
			url: `/api/series/${sid}/games`,
			cookies: { sid: signSid(app, OP) },
			payload: {
				gameNumber: 1,
				team1Side: "BLUE",
				winningTeam: "TEAM_1",
				picks: {
					TEAM_1: [{ role: "TOP", championId: 1 }],
					TEAM_2: [{ role: "TOP", championId: 2 }],
				},
				bans: { TEAM_1: [], TEAM_2: [] },
			},
		});

		// MMR 변동 확인 — u1 +16
		const mmrBefore = db.prepare("SELECT mmr FROM user_lane_mmr WHERE user_id = 'u1'").get() as {
			mmr: number;
		};
		expect(mmrBefore.mmr).toBeGreaterThan(1500);

		const del = await app.inject({
			method: "DELETE",
			url: `/api/series/${sid}/games/last`,
			cookies: { sid: signSid(app, OP) },
		});
		expect(del.statusCode).toBe(200);
		expect(del.json()).toMatchObject({ ok: true, deletedGame: 1 });

		// 게임 삭제됨
		expect(db.prepare("SELECT COUNT(*) AS n FROM games WHERE series_id = ?").get(sid)).toEqual({
			n: 0,
		});
		// MMR 차감됨 (rough — may not be exactly 1500 due to formula, but should be ≤ pre-change)
		const mmrAfter = db.prepare("SELECT mmr FROM user_lane_mmr WHERE user_id = 'u1'").get() as {
			mmr: number;
		};
		expect(mmrAfter.mmr).toBeLessThan(mmrBefore.mmr);
	});

	it("게임 0개 → 409", async () => {
		const { app, db } = await buildTestApp({ canEdit: true });
		const { seasonId } = seedRecruitment(db);
		const sid = (
			db
				.prepare("INSERT INTO series (season_id, created_by) VALUES (?, ?) RETURNING id")
				.get(seasonId, OP) as { id: number }
		).id;
		const res = await app.inject({
			method: "DELETE",
			url: `/api/series/${sid}/games/last`,
			cookies: { sid: signSid(app, OP) },
		});
		expect(res.statusCode).toBe(409);
	});
});

describe("POST /api/series/:id/revert", () => {
	it("게임 0개 + IN_PROGRESS → 모집 CLOSED 복귀 + 시리즈 soft-delete + audit log", async () => {
		const { app, db } = await buildTestApp({ canEdit: true });
		const { seasonId, recruitmentId } = seedRecruitment(db, "CONVERTED");
		const sid = (
			db
				.prepare("INSERT INTO series (season_id, created_by) VALUES (?, ?) RETURNING id")
				.get(seasonId, OP) as { id: number }
		).id;
		db
			.prepare("UPDATE recruitments SET converted_series_id = ? WHERE id = ?")
			.run(sid, recruitmentId);

		const res = await app.inject({
			method: "POST",
			url: `/api/series/${sid}/revert`,
			cookies: { sid: signSid(app, OP) },
		});
		expect(res.statusCode).toBe(200);
		expect(res.json()).toMatchObject({ ok: true, recruitmentId });

		// soft-delete: 행 보존 + deleted_at set
		const sRow = db.prepare("SELECT deleted_at FROM series WHERE id = ?").get(sid) as
			| { deleted_at: number | null }
			| undefined;
		expect(sRow).toBeDefined();
		expect(sRow?.deleted_at).not.toBeNull();

		const rec = db
			.prepare("SELECT status, converted_series_id FROM recruitments WHERE id = ?")
			.get(recruitmentId) as { status: string; converted_series_id: number | null };
		expect(rec.status).toBe("CLOSED");
		expect(rec.converted_series_id).toBeNull();

		// audit log 1건 — series.revert
		const audit = db
			.prepare(
				"SELECT operator_id, action, target_id FROM admin_audit_log WHERE action = 'series.revert'",
			)
			.get() as { operator_id: string; action: string; target_id: string } | undefined;
		expect(audit).toBeDefined();
		expect(audit?.operator_id).toBe(OP);
		expect(audit?.target_id).toBe(String(sid));
	});
});

describe("GET /api/recruitments + /api/recruitments/:id", () => {
	it("listing — CLOSED 만 반환", async () => {
		const { app, db } = await buildTestApp();
		const { recruitmentId } = seedRecruitment(db, "OPEN");
		const seasonRow = db
			.prepare("SELECT season_id FROM recruitments WHERE id = ?")
			.get(recruitmentId) as { season_id: number };
		// 추가 CLOSED 모집 1개
		db
			.prepare(
				"INSERT INTO recruitments (season_id, target_count, created_by, status) VALUES (?, 2, ?, 'CLOSED')",
			)
			.run(seasonRow.season_id, OP);

		const res = await app.inject({
			method: "GET",
			url: "/api/recruitments",
			cookies: { sid: signSid(app, OP) },
		});
		const { recruitments } = res.json() as { recruitments: { status: string }[] };
		expect(recruitments).toHaveLength(1);
		expect(recruitments[0]?.status).toBe("CLOSED");
	});

	it("detail — recruitment + participants + entryDraft", async () => {
		const { app, db } = await buildTestApp();
		const { recruitmentId } = seedRecruitment(db);
		db
			.prepare("INSERT INTO recruitment_participants (recruitment_id, user_id) VALUES (?, ?)")
			.run(recruitmentId, "u1");

		const res = await app.inject({
			method: "GET",
			url: `/api/recruitments/${recruitmentId}`,
			cookies: { sid: signSid(app, OP) },
		});
		expect(res.statusCode).toBe(200);
		const body = res.json() as {
			recruitment: { id: number };
			participants: { userId: string }[];
			entryDraft: unknown;
		};
		expect(body.recruitment.id).toBe(recruitmentId);
		expect(body.participants).toHaveLength(1);
		expect(body.participants[0]?.userId).toBe("u1");
		expect(body.entryDraft).toBeNull();
	});
});
