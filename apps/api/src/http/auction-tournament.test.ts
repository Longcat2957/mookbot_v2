import { __resetDriver, type TestDb } from "@mookbot/core/test-utils/db-harness";
import { afterEach, describe, expect, it } from "vitest";
import { buildTestApp, signSid } from "../test-utils/build-app.js";

afterEach(() => {
	__resetDriver();
});

const OP = "operator-uid";
const TOURNAMENT_ID = 9001;

function seedAuctionBidding(db: TestDb): void {
	const seasonId = (
		db
			.prepare("INSERT INTO seasons (name, started_at) VALUES (?, unixepoch()) RETURNING id")
			.get("Auction") as { id: number }
	).id;
	for (const id of [OP, "c1", "c2", "p1", "p2", "p3"]) {
		db.prepare("INSERT INTO users (discord_id, display_name) VALUES (?, ?)").run(id, id);
	}
	db
		.prepare(
			`INSERT INTO auction_tournaments (id, season_id, format, status, created_by)
			 VALUES (?, ?, 10, 'BIDDING', ?)`,
		)
		.run(TOURNAMENT_ID, seasonId, OP);
	db
		.prepare(
			`INSERT INTO auction_recruitments (id, season_id, target_count, created_by, status, converted_tournament_id)
			 VALUES (?, ?, 10, ?, 'CONVERTED', ?)`,
		)
		.run(TOURNAMENT_ID, seasonId, OP, TOURNAMENT_ID);
	for (const userId of ["c1", "c2", "p1", "p2", "p3"]) {
		db
			.prepare("INSERT INTO auction_recruitment_participants (recruitment_id, user_id) VALUES (?, ?)")
			.run(TOURNAMENT_ID, userId);
	}
	const team1Id = (
		db
			.prepare(
				"INSERT INTO auction_teams (tournament_id, team_index, captain_user_id) VALUES (?, 1, 'c1') RETURNING id",
			)
			.get(TOURNAMENT_ID) as { id: number }
	).id;
	const team2Id = (
		db
			.prepare(
				"INSERT INTO auction_teams (tournament_id, team_index, captain_user_id) VALUES (?, 2, 'c2') RETURNING id",
			)
			.get(TOURNAMENT_ID) as { id: number }
	).id;
	db
		.prepare(
			"INSERT INTO auction_team_members (team_id, user_id, acquired_via) VALUES (?, ?, 'MANUAL')",
		)
		.run(team1Id, "c1");
	db
		.prepare(
			"INSERT INTO auction_team_members (team_id, user_id, acquired_via) VALUES (?, ?, 'MANUAL')",
		)
		.run(team2Id, "c2");
}

async function draw(app: Awaited<ReturnType<typeof buildTestApp>>["app"]): Promise<string> {
	const res = await app.inject({
		method: "POST",
		url: `/api/auction-tournaments/${TOURNAMENT_ID}/draw`,
		cookies: { sid: signSid(app, OP) },
	});
	expect(res.statusCode).toBe(200);
	const body = res.json() as { userId: string | null; done: boolean };
	expect(body.done).toBe(false);
	expect(body.userId).toBeTruthy();
	return body.userId as string;
}

async function cancelDraw(app: Awaited<ReturnType<typeof buildTestApp>>["app"]): Promise<void> {
	const res = await app.inject({
		method: "POST",
		url: `/api/auction-tournaments/${TOURNAMENT_ID}/cancel-draw`,
		cookies: { sid: signSid(app, OP) },
	});
	expect(res.statusCode).toBe(200);
}

describe("auction bidding queue", () => {
	it("유찰된 현재 매물은 queue 뒤로 보내고 남은 후보를 먼저 뽑는다", async () => {
		const { app, db } = await buildTestApp({ canEdit: true });
		seedAuctionBidding(db);

		const first = await draw(app);
		await cancelDraw(app);
		const second = await draw(app);
		await cancelDraw(app);
		const third = await draw(app);
		await cancelDraw(app);
		const fourth = await draw(app);

		expect(new Set([first, second, third]).size).toBe(3);
		expect(fourth).toBe(first);
	});
});
