import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, installDbDriver, type TestDb } from "../test-utils/db-harness.js";
import { createAuctionTeam } from "./auction-teams.js";

import {
	cancelAuctionTournament,
	createAuctionTournament,
	getAuctionTournament,
	softDeleteAuctionTournament,
} from "./auction-tournaments.js";
import { createSeason } from "./seasons.js";
import { upsertUser } from "./users.js";

let db: TestDb;
let seasonId: number;
const OP = "op";

beforeEach(async () => {
	db = createTestDb();
	installDbDriver(db);
	const s = await createSeason("Test");
	seasonId = s.id;
	await upsertUser(OP, "Op");
	await upsertUser("c1", "Cap1");
	await upsertUser("c2", "Cap2");
});

describe("createAuctionTournament", () => {
	it("최초 생성 — INSERT", async () => {
		const t = await createAuctionTournament({ id: 100, seasonId, format: 10, createdBy: OP });
		expect(t.id).toBe(100);
		expect(t.status).toBe("CAPTAIN_PICK");
		expect(t.deleted_at).toBeNull();
	});

	it("살아있는 동일 id → 에러", async () => {
		await createAuctionTournament({ id: 101, seasonId, format: 10, createdBy: OP });
		await expect(
			createAuctionTournament({ id: 101, seasonId, format: 10, createdBy: OP }),
		).rejects.toThrow(/이미 존재/);
	});

	it("soft-deleted + 팀 0개 → revive (CAPTAIN_PICK)", async () => {
		await createAuctionTournament({ id: 102, seasonId, format: 10, createdBy: OP });
		await softDeleteAuctionTournament(102);
		const revived = await createAuctionTournament({
			id: 102,
			seasonId,
			format: 10,
			createdBy: OP,
		});
		expect(revived.id).toBe(102);
		expect(revived.deleted_at).toBeNull();
		expect(revived.status).toBe("CAPTAIN_PICK");
	});

	it("CANCELLED + 팀 0개 → revive (history-preserving cancel 후 재사용)", async () => {
		await createAuctionTournament({ id: 103, seasonId, format: 10, createdBy: OP });
		await cancelAuctionTournament(103);
		const revived = await createAuctionTournament({
			id: 103,
			seasonId,
			format: 10,
			createdBy: OP,
		});
		expect(revived.id).toBe(103);
		expect(revived.status).toBe("CAPTAIN_PICK");
		expect(revived.deleted_at).toBeNull();
	});

	it("soft-deleted + 팀 ≥1 → revive 거부 (ghost team 방지)", async () => {
		await createAuctionTournament({ id: 104, seasonId, format: 10, createdBy: OP });
		await createAuctionTeam({ tournamentId: 104, teamIndex: 1, captainUserId: "c1" });
		await softDeleteAuctionTournament(104);

		await expect(
			createAuctionTournament({ id: 104, seasonId, format: 10, createdBy: OP }),
		).rejects.toThrow(/이미 존재/);

		// 원본 row 와 team 그대로 — history 보존.
		const teamCount = db
			.prepare("SELECT COUNT(*) AS n FROM auction_teams WHERE tournament_id = 104")
			.get() as { n: number };
		expect(teamCount.n).toBe(1);
	});

	it("CANCELLED + 팀 ≥1 → revive 거부", async () => {
		await createAuctionTournament({ id: 105, seasonId, format: 10, createdBy: OP });
		await createAuctionTeam({ tournamentId: 105, teamIndex: 1, captainUserId: "c1" });
		await createAuctionTeam({ tournamentId: 105, teamIndex: 2, captainUserId: "c2" });
		await cancelAuctionTournament(105);

		await expect(
			createAuctionTournament({ id: 105, seasonId, format: 10, createdBy: OP }),
		).rejects.toThrow(/이미 존재/);
	});

	it("COMPLETED 행은 revive 거부 (deleted_at != NULL 도 CANCELLED 도 아님)", async () => {
		await createAuctionTournament({ id: 106, seasonId, format: 10, createdBy: OP });
		db
			.prepare(
				"UPDATE auction_tournaments SET status = 'COMPLETED', ended_at = unixepoch() WHERE id = 106",
			)
			.run();
		await expect(
			createAuctionTournament({ id: 106, seasonId, format: 10, createdBy: OP }),
		).rejects.toThrow(/이미 존재/);
	});
});

describe("softDeleteAuctionTournament", () => {
	it("토너먼트 soft-delete + 종속 auction_matches 도 같이 soft-delete", async () => {
		await createAuctionTournament({ id: 200, seasonId, format: 10, createdBy: OP });
		// 종속 auction_match 직접 INSERT — 팀 fixture 도 같이
		await createAuctionTeam({ tournamentId: 200, teamIndex: 1, captainUserId: "c1" });
		await createAuctionTeam({ tournamentId: 200, teamIndex: 2, captainUserId: "c2" });
		db
			.prepare(
				`INSERT INTO auction_matches (tournament_id, round, bracket_index, team1_id, team2_id, format, created_by)
				 SELECT 200, 'SINGLE', NULL,
				        (SELECT id FROM auction_teams WHERE tournament_id = 200 AND team_index = 1),
				        (SELECT id FROM auction_teams WHERE tournament_id = 200 AND team_index = 2),
				        'BO3', ?`,
			)
			.run(OP);

		await softDeleteAuctionTournament(200);

		expect(await getAuctionTournament(200)).toBeUndefined();
		const m = db
			.prepare("SELECT deleted_at FROM auction_matches WHERE tournament_id = 200")
			.get() as { deleted_at: number | null };
		expect(m.deleted_at).not.toBeNull();
	});
});
