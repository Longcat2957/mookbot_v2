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

	it("COMPLETED 시리즈도 draft 저장 허용 — 완료 게임 수정 준비", async () => {
		const { app, db } = await buildTestApp({ canEdit: true });
		const { seasonId } = seedRecruitment(db);
		const sid = (
			db
				.prepare(
					"INSERT INTO series (season_id, created_by, status, winning_team) VALUES (?, ?, 'COMPLETED', 'TEAM_1') RETURNING id",
				)
				.get(seasonId, OP) as { id: number }
		).id;

		const draft = { games: [{ gameNumber: 1, team1Side: "RED" }], currentGame: 1 };
		const put = await app.inject({
			method: "PUT",
			url: `/api/series/${sid}/pickban`,
			cookies: { sid: signSid(app, OP) },
			payload: draft,
		});
		expect(put.statusCode).toBe(200);

		const raw = db.prepare("SELECT v FROM guild_kv WHERE k = ?").get(`pickban:${sid}`) as {
			v: string;
		};
		expect(JSON.parse(raw.v)).toEqual(draft);
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
	it("최근 게임 삭제 + MMR / games_played / wins 모두 차감 (공유 undoLastGame)", async () => {
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

		// 기록 직후: 양 유저 모두 games_played=1, mmr 변동
		const u1Before = db
			.prepare("SELECT mmr, games_played, wins FROM user_lane_mmr WHERE user_id = 'u1'")
			.get() as { mmr: number; games_played: number; wins: number };
		const u2Before = db
			.prepare("SELECT mmr, games_played, wins FROM user_lane_mmr WHERE user_id = 'u2'")
			.get() as { mmr: number; games_played: number; wins: number };
		expect(u1Before.mmr).toBeGreaterThan(1500);
		expect(u1Before.games_played).toBe(1);
		expect(u1Before.wins).toBe(1);
		expect(u2Before.mmr).toBeLessThan(1500);
		expect(u2Before.games_played).toBe(1);
		expect(u2Before.wins).toBe(0);

		const del = await app.inject({
			method: "DELETE",
			url: `/api/series/${sid}/games/last`,
			cookies: { sid: signSid(app, OP) },
		});
		expect(del.statusCode).toBe(200);
		expect(del.json()).toMatchObject({ ok: true, deletedGame: 1 });

		// 게임 행 / cascade — game_stats / mmr_changes 모두 삭제
		expect(db.prepare("SELECT COUNT(*) AS n FROM games WHERE ranked_series_id = ?").get(sid)).toEqual(
			{
				n: 0,
			},
		);
		expect(db.prepare("SELECT COUNT(*) AS n FROM mmr_changes").get()).toEqual({ n: 0 });

		// user_lane_mmr — mmr 1500 복귀 + 누적 카운터 reset.
		// 회귀 가드: 옛 핸들러는 games_played / wins 를 차감하지 않아 영구 부풀어 있었음.
		const u1After = db
			.prepare("SELECT mmr, games_played, wins FROM user_lane_mmr WHERE user_id = 'u1'")
			.get() as { mmr: number; games_played: number; wins: number };
		const u2After = db
			.prepare("SELECT mmr, games_played, wins FROM user_lane_mmr WHERE user_id = 'u2'")
			.get() as { mmr: number; games_played: number; wins: number };
		expect(u1After.mmr).toBeCloseTo(1500, 5);
		expect(u1After.games_played).toBe(0);
		expect(u1After.wins).toBe(0);
		expect(u2After.mmr).toBeCloseTo(1500, 5);
		expect(u2After.games_played).toBe(0);
		expect(u2After.wins).toBe(0);

		// audit log — game.undone 1건 (restoredFromCompleted=false)
		const audit = db
			.prepare(
				"SELECT operator_id, action, target_id, payload FROM admin_audit_log WHERE action = 'game.undone'",
			)
			.get() as { operator_id: string; action: string; target_id: string; payload: string };
		expect(audit.operator_id).toBe(OP);
		const payload = JSON.parse(audit.payload) as { restoredFromCompleted: boolean };
		expect(payload.restoredFromCompleted).toBe(false);
	});

	it("COMPLETED 시리즈에서 undo → IN_PROGRESS 복원 + 카운터 차감", async () => {
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

		// 2-0 → 자동 COMPLETED
		for (const n of [1, 2] as const) {
			await app.inject({
				method: "POST",
				url: `/api/series/${sid}/games`,
				cookies: { sid: signSid(app, OP) },
				payload: {
					gameNumber: n,
					team1Side: "BLUE",
					winningTeam: "TEAM_1",
					picks: {
						TEAM_1: [{ role: "TOP", championId: 1 }],
						TEAM_2: [{ role: "TOP", championId: 2 }],
					},
					bans: { TEAM_1: [], TEAM_2: [] },
				},
			});
		}
		expect(
			(db.prepare("SELECT status FROM series WHERE id = ?").get(sid) as { status: string }).status,
		).toBe("COMPLETED");
		expect(
			(
				db.prepare("SELECT games_played FROM user_lane_mmr WHERE user_id = 'u1'").get() as {
					games_played: number;
				}
			).games_played,
		).toBe(2);

		const del = await app.inject({
			method: "DELETE",
			url: `/api/series/${sid}/games/last`,
			cookies: { sid: signSid(app, OP) },
		});
		expect(del.statusCode).toBe(200);

		const after = db.prepare("SELECT status, winning_team FROM series WHERE id = ?").get(sid) as {
			status: string;
			winning_team: string | null;
		};
		expect(after.status).toBe("IN_PROGRESS");
		expect(after.winning_team).toBeNull();

		// 카운터: 2 → 1
		const u1Counters = db
			.prepare("SELECT games_played, wins FROM user_lane_mmr WHERE user_id = 'u1'")
			.get() as { games_played: number; wins: number };
		expect(u1Counters).toEqual({ games_played: 1, wins: 1 });
	});

	it("CANCELLED 시리즈 → 409", async () => {
		const { app, db } = await buildTestApp({ canEdit: true });
		const { seasonId } = seedRecruitment(db);
		const sid = (
			db
				.prepare(
					"INSERT INTO series (season_id, created_by, status) VALUES (?, ?, 'CANCELLED') RETURNING id",
				)
				.get(seasonId, OP) as { id: number }
		).id;
		const res = await app.inject({
			method: "DELETE",
			url: `/api/series/${sid}/games/last`,
			cookies: { sid: signSid(app, OP) },
		});
		expect(res.statusCode).toBe(409);
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
	it("게임 0개 + IN_PROGRESS → 모집 CLOSED 복귀 + 시리즈 CANCELLED 보존 + audit log", async () => {
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

		// history-preserving: 행 보존 + status CANCELLED + deleted_at NULL.
		// 시리즈목록/admin/history 가 deleted_at IS NULL 로 필터해도 흔적이 보임.
		const sRow = db.prepare("SELECT status, deleted_at FROM series WHERE id = ?").get(sid) as
			| { status: string; deleted_at: number | null }
			| undefined;
		expect(sRow).toBeDefined();
		expect(sRow?.status).toBe("CANCELLED");
		expect(sRow?.deleted_at).toBeNull();

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

	it("revert 된 시리즈가 같은 모집 재확정 시 같은 id 로 revive (CANCELLED → IN_PROGRESS)", async () => {
		const { app, db } = await buildTestApp({ canEdit: true });
		const { recruitmentId } = seedRecruitment(db, "CLOSED");

		// 1) 엔트리 확정 → 시리즈 생성
		const create1 = await app.inject({
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
		expect(create1.statusCode).toBe(200);
		const { seriesId } = create1.json() as { seriesId: number };

		// 2) revert → CANCELLED + 모집 CLOSED
		const rev = await app.inject({
			method: "POST",
			url: `/api/series/${seriesId}/revert`,
			cookies: { sid: signSid(app, OP) },
		});
		expect(rev.statusCode).toBe(200);

		// 3) 같은 모집 재확정 → 같은 id 로 revive
		const create2 = await app.inject({
			method: "POST",
			url: "/api/series",
			cookies: { sid: signSid(app, OP) },
			payload: {
				recruitmentId,
				assignments: [
					{ userId: "u1", team: "TEAM_1", role: "MID" },
					{ userId: "u2", team: "TEAM_2", role: "MID" },
				],
			},
		});
		expect(create2.statusCode).toBe(200);
		expect((create2.json() as { seriesId: number }).seriesId).toBe(seriesId);

		const sRow = db.prepare("SELECT status, deleted_at FROM series WHERE id = ?").get(seriesId) as {
			status: string;
			deleted_at: number | null;
		};
		expect(sRow.status).toBe("IN_PROGRESS");
		expect(sRow.deleted_at).toBeNull();
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

describe("POST /api/recruitments/:id/reopen", () => {
	it("CLOSED 모집 → OPEN + entry draft 삭제", async () => {
		const { app, db } = await buildTestApp({ canEdit: true });
		const { recruitmentId } = seedRecruitment(db, "CLOSED");
		db
			.prepare("INSERT INTO guild_kv (k, v, updated_by) VALUES (?, ?, ?)")
			.run(`entry:${recruitmentId}`, JSON.stringify({ assignments: { u1: "TEAM_1_TOP" } }), OP);

		const res = await app.inject({
			method: "POST",
			url: `/api/recruitments/${recruitmentId}/reopen`,
			cookies: { sid: signSid(app, OP) },
		});

		expect(res.statusCode).toBe(200);
		const rec = db
			.prepare("SELECT status, converted_series_id FROM recruitments WHERE id = ?")
			.get(recruitmentId) as { status: string; converted_series_id: number | null };
		expect(rec).toEqual({ status: "OPEN", converted_series_id: null });
		expect(
			db.prepare("SELECT v FROM guild_kv WHERE k = ?").get(`entry:${recruitmentId}`),
		).toBeUndefined();
	});

	it("zero-game CONVERTED 모집 → OPEN + 연결 시리즈 CANCELLED", async () => {
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
			url: `/api/recruitments/${recruitmentId}/reopen`,
			cookies: { sid: signSid(app, OP) },
		});

		expect(res.statusCode).toBe(200);
		expect(
			db
				.prepare("SELECT status, converted_series_id FROM recruitments WHERE id = ?")
				.get(recruitmentId),
		).toEqual({ status: "OPEN", converted_series_id: null });
		expect(
			(db.prepare("SELECT status FROM series WHERE id = ?").get(sid) as { status: string }).status,
		).toBe("CANCELLED");
	});
});

describe("GET /api/users/:id/preferences", () => {
	it("unknown user → 404", async () => {
		const { app } = await buildTestApp();
		const res = await app.inject({
			method: "GET",
			url: "/api/users/ghost/preferences",
			cookies: { sid: signSid(app, OP) },
		});
		expect(res.statusCode).toBe(404);
	});

	it("등록 사용자 빈 풀 → 라인 5개 모두 빈 배열", async () => {
		const { app, db } = await buildTestApp();
		db.prepare("INSERT INTO users (discord_id, display_name) VALUES (?, ?)").run("u1", "Alice");

		const res = await app.inject({
			method: "GET",
			url: "/api/users/u1/preferences",
			cookies: { sid: signSid(app, OP) },
		});
		expect(res.statusCode).toBe(200);
		const body = res.json() as {
			user: { discordId: string; displayName: string };
			maxPerRole: number;
			preferences: Record<string, unknown[]>;
		};
		expect(body.user).toEqual({ discordId: "u1", displayName: "Alice" });
		expect(body.maxPerRole).toBe(10);
		expect(body.preferences).toEqual({
			TOP: [],
			JUNGLE: [],
			MID: [],
			BOTTOM: [],
			SUPPORT: [],
		});
	});

	it("저장된 풀 반환", async () => {
		const { app, db } = await buildTestApp();
		db.prepare("INSERT INTO users (discord_id, display_name) VALUES (?, ?)").run("u1", "Alice");
		db
			.prepare(
				"INSERT INTO user_champion_preferences (user_id, role, champion_id, position) VALUES (?,?,?,?)",
			)
			.run("u1", "TOP", 266, 0);
		db
			.prepare(
				"INSERT INTO user_champion_preferences (user_id, role, champion_id, position) VALUES (?,?,?,?)",
			)
			.run("u1", "TOP", 85, 1);

		const res = await app.inject({
			method: "GET",
			url: "/api/users/u1/preferences",
			cookies: { sid: signSid(app, OP) },
		});
		const body = res.json() as {
			preferences: Record<string, { championId: number }[]>;
		};
		expect(body.preferences.TOP?.map((c) => c.championId)).toEqual([266, 85]);
	});

	it("auth 없음 → 401", async () => {
		const { app } = await buildTestApp();
		const res = await app.inject({
			method: "GET",
			url: "/api/users/u1/preferences",
		});
		expect(res.statusCode).toBe(401);
	});
});

describe("PUT /api/users/me/preferences", () => {
	async function setupMe() {
		const { app, db } = await buildTestApp();
		db.prepare("INSERT INTO users (discord_id, display_name) VALUES (?, ?)").run(OP, "Op");
		return { app, db };
	}

	it("정상 저장 + GET 으로 확인", async () => {
		const { app } = await setupMe();
		const put = await app.inject({
			method: "PUT",
			url: "/api/users/me/preferences",
			cookies: { sid: signSid(app, OP) },
			payload: { role: "TOP", championIds: [266, 85, 84] },
		});
		expect(put.statusCode).toBe(200);

		const get = await app.inject({
			method: "GET",
			url: `/api/users/${OP}/preferences`,
			cookies: { sid: signSid(app, OP) },
		});
		const body = get.json() as { preferences: Record<string, { championId: number }[]> };
		expect(body.preferences.TOP?.map((c) => c.championId)).toEqual([266, 85, 84]);
	});

	it("같은 라인 재저장 — 교체 (이전 풀 삭제)", async () => {
		const { app } = await setupMe();
		await app.inject({
			method: "PUT",
			url: "/api/users/me/preferences",
			cookies: { sid: signSid(app, OP) },
			payload: { role: "TOP", championIds: [1, 2, 3] },
		});
		await app.inject({
			method: "PUT",
			url: "/api/users/me/preferences",
			cookies: { sid: signSid(app, OP) },
			payload: { role: "TOP", championIds: [4, 5] },
		});
		const get = await app.inject({
			method: "GET",
			url: `/api/users/${OP}/preferences`,
			cookies: { sid: signSid(app, OP) },
		});
		const body = get.json() as { preferences: Record<string, { championId: number }[]> };
		expect(body.preferences.TOP?.map((c) => c.championId)).toEqual([4, 5]);
	});

	it("invalid role → 400", async () => {
		const { app } = await setupMe();
		const res = await app.inject({
			method: "PUT",
			url: "/api/users/me/preferences",
			cookies: { sid: signSid(app, OP) },
			payload: { role: "BANANA", championIds: [1] },
		});
		expect(res.statusCode).toBe(400);
	});

	it("championIds 미배열 → 400", async () => {
		const { app } = await setupMe();
		const res = await app.inject({
			method: "PUT",
			url: "/api/users/me/preferences",
			cookies: { sid: signSid(app, OP) },
			payload: { role: "TOP", championIds: "nope" },
		});
		expect(res.statusCode).toBe(400);
	});

	it("11개 → 400 (라인당 10개 한도)", async () => {
		const { app } = await setupMe();
		const res = await app.inject({
			method: "PUT",
			url: "/api/users/me/preferences",
			cookies: { sid: signSid(app, OP) },
			payload: { role: "TOP", championIds: Array.from({ length: 11 }, (_, i) => i + 1) },
		});
		expect(res.statusCode).toBe(400);
	});

	it("non-integer → 400", async () => {
		const { app } = await setupMe();
		const res = await app.inject({
			method: "PUT",
			url: "/api/users/me/preferences",
			cookies: { sid: signSid(app, OP) },
			payload: { role: "TOP", championIds: [1.5] },
		});
		expect(res.statusCode).toBe(400);
	});

	it("자기 user 행 없음 → 404 (등록 필요)", async () => {
		const { app } = await buildTestApp(); // setupMe 안 함
		const res = await app.inject({
			method: "PUT",
			url: "/api/users/me/preferences",
			cookies: { sid: signSid(app, "ghost") },
			payload: { role: "TOP", championIds: [1] },
		});
		expect(res.statusCode).toBe(404);
	});

	it("auth 없음 → 401", async () => {
		const { app } = await buildTestApp();
		const res = await app.inject({
			method: "PUT",
			url: "/api/users/me/preferences",
			payload: { role: "TOP", championIds: [1] },
		});
		expect(res.statusCode).toBe(401);
	});
});

describe("GET /api/users/search", () => {
	function seed(db: TestDb) {
		db.prepare("INSERT INTO users (discord_id, display_name) VALUES (?, ?)").run("d1", "Faker");
		db.prepare("INSERT INTO users (discord_id, display_name) VALUES (?, ?)").run("d2", "Bob");
		db
			.prepare(
				"INSERT INTO riot_accounts (puuid, user_id, game_name, tag_line, is_main) VALUES (?, ?, ?, ?, 1)",
			)
			.run("p-faker", "d1", "Hide on bush", "KR1");
	}

	it("display_name 부분일치 + 메인 라이엇 첨부", async () => {
		const { app, db } = await buildTestApp();
		seed(db);
		const res = await app.inject({
			method: "GET",
			url: "/api/users/search?q=fak",
			cookies: { sid: signSid(app, OP) },
		});
		expect(res.statusCode).toBe(200);
		const body = res.json() as {
			query: string;
			users: { discordId: string; displayName: string; mainAccount: { gameName: string } | null }[];
		};
		expect(body.query).toBe("fak");
		expect(body.users).toHaveLength(1);
		expect(body.users[0]?.discordId).toBe("d1");
		expect(body.users[0]?.mainAccount?.gameName).toBe("Hide on bush");
	});

	it("riot game_name 매칭 (메인 계정)", async () => {
		const { app, db } = await buildTestApp();
		seed(db);
		const res = await app.inject({
			method: "GET",
			url: "/api/users/search?q=Hide",
			cookies: { sid: signSid(app, OP) },
		});
		const body = res.json() as { users: { discordId: string }[] };
		expect(body.users.map((u) => u.discordId)).toEqual(["d1"]);
	});

	it("빈 쿼리 → users []", async () => {
		const { app, db } = await buildTestApp();
		seed(db);
		const res = await app.inject({
			method: "GET",
			url: "/api/users/search?q=",
			cookies: { sid: signSid(app, OP) },
		});
		expect((res.json() as { users: unknown[] }).users).toEqual([]);
	});

	it("메인 계정 없는 사용자 → mainAccount null", async () => {
		const { app, db } = await buildTestApp();
		db.prepare("INSERT INTO users (discord_id, display_name) VALUES (?, ?)").run("d3", "Nomain");
		const res = await app.inject({
			method: "GET",
			url: "/api/users/search?q=Nom",
			cookies: { sid: signSid(app, OP) },
		});
		const body = res.json() as { users: { mainAccount: unknown }[] };
		expect(body.users[0]?.mainAccount).toBeNull();
	});

	it("auth 없음 → 401", async () => {
		const { app } = await buildTestApp();
		const res = await app.inject({ method: "GET", url: "/api/users/search?q=x" });
		expect(res.statusCode).toBe(401);
	});
});
