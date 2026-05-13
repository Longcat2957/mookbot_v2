// 경매내전 토너먼트 — 한 행사 (10인 = 1매치, 20인 = 3매치 4강+결승) 단위.
// id 는 명시 부여 (auction_recruitment.id 와 동일 — v0.3.4 패턴 일관).
// status 가 경매 단계기계 (CAPTAIN_PICK → POINT_ALLOC → BIDDING → PLACEMENT
// → BRACKET_SETUP → IN_GAME → COMPLETED) 추적.

import { execute, query, queryOne } from "../cloudflare/d1.js";

export type AuctionTournamentStatus =
	| "CAPTAIN_PICK"
	| "POINT_ALLOC"
	| "BIDDING"
	| "PLACEMENT"
	| "BRACKET_SETUP"
	| "IN_GAME"
	| "COMPLETED"
	| "CANCELLED";

export interface AuctionTournamentRow {
	id: number;
	season_id: number;
	format: 10 | 20;
	status: AuctionTournamentStatus;
	champion_team_id: number | null;
	started_at: number;
	ended_at: number | null;
	created_by: string;
	end_card_channel_id: string | null;
	end_card_message_id: string | null;
	deleted_at: number | null;
}

export async function createAuctionTournament(input: {
	id: number;
	seasonId: number;
	format: 10 | 20;
	createdBy: string;
}): Promise<AuctionTournamentRow> {
	// 같은 id 의 행이 revive 가능하면 revive (모집 ID 동일하게 다시 만드는 경로):
	//   - soft-deleted (deleted_at != NULL) 또는 CANCELLED 인 행이며
	//   - auction_teams 가 0개 인 경우에만 (= captain pick 진행 전이거나, hard-clean 된 상태).
	// auction_teams 가 1개라도 있으면 revive 거부 — 종속 auction_team_members / auction_bids
	// 가 새 토너먼트에 ghost 로 attach 되는 corruption 방지. (series.ts 의 game-count
	// invariant 와 동일 패턴.)
	const existing = await queryOne<AuctionTournamentRow>(
		`SELECT * FROM auction_tournaments WHERE id = ?`,
		[input.id],
	);
	let canRevive = false;
	if (existing && (existing.deleted_at != null || existing.status === "CANCELLED")) {
		const teamCount = await queryOne<{ n: number }>(
			`SELECT COUNT(*) AS n FROM auction_teams WHERE tournament_id = ?`,
			[input.id],
		);
		if ((teamCount?.n ?? 0) === 0) canRevive = true;
	}
	if (existing && !canRevive) {
		throw new Error(
			`createAuctionTournament: 토너먼트 #${input.id} 이미 존재 (status=${existing.status})`,
		);
	}
	if (existing && canRevive) {
		await execute(
			`UPDATE auction_tournaments
			 SET season_id = ?, format = ?, status = 'CAPTAIN_PICK', champion_team_id = NULL,
			     started_at = unixepoch(), ended_at = NULL, created_by = ?,
			     end_card_channel_id = NULL, end_card_message_id = NULL,
			     deleted_at = NULL
			 WHERE id = ?`,
			[input.seasonId, input.format, input.createdBy, input.id],
		);
		const revived = await queryOne<AuctionTournamentRow>(
			`SELECT * FROM auction_tournaments WHERE id = ?`,
			[input.id],
		);
		if (!revived) throw new Error("createAuctionTournament: revive failed");
		return revived;
	}
	const [row] = await query<AuctionTournamentRow>(
		`INSERT INTO auction_tournaments (id, season_id, format, created_by)
		 VALUES (?, ?, ?, ?)
		 RETURNING *`,
		[input.id, input.seasonId, input.format, input.createdBy],
	);
	if (!row) throw new Error("createAuctionTournament: insert failed");
	return row;
}

export async function getAuctionTournament(id: number): Promise<AuctionTournamentRow | undefined> {
	return queryOne<AuctionTournamentRow>(
		`SELECT * FROM auction_tournaments WHERE id = ? AND deleted_at IS NULL`,
		[id],
	);
}

export async function setAuctionTournamentStatus(
	id: number,
	status: AuctionTournamentStatus,
): Promise<void> {
	await execute(`UPDATE auction_tournaments SET status = ? WHERE id = ? AND deleted_at IS NULL`, [
		status,
		id,
	]);
}

export async function completeAuctionTournament(id: number, championTeamId: number): Promise<void> {
	await execute(
		`UPDATE auction_tournaments SET status = 'COMPLETED', champion_team_id = ?, ended_at = unixepoch()
		 WHERE id = ? AND deleted_at IS NULL`,
		[championTeamId, id],
	);
}

export async function cancelAuctionTournament(id: number): Promise<void> {
	await execute(
		`UPDATE auction_tournaments SET status = 'CANCELLED', ended_at = unixepoch()
		 WHERE id = ? AND deleted_at IS NULL`,
		[id],
	);
}

export async function softDeleteAuctionTournament(id: number): Promise<void> {
	// v0.11.0: 종속 auction_matches 도 같이 soft-delete. 옛 구조에선 series 가 함께
	// soft-delete 됐으나 분리 후 auction_matches 가 lifecycle 보유.
	// 종속 auction_teams / auction_team_members / auction_bids 는 토너먼트의 hard-delete
	// 시에만 CASCADE 되지만, softDelete 는 historical 보존 목적이라 그대로 둠.
	await execute(
		`UPDATE auction_matches SET deleted_at = unixepoch() WHERE tournament_id = ? AND deleted_at IS NULL`,
		[id],
	);
	await execute(
		`UPDATE auction_tournaments SET deleted_at = unixepoch() WHERE id = ? AND deleted_at IS NULL`,
		[id],
	);
}

export async function listOpenAuctionTournaments(): Promise<AuctionTournamentRow[]> {
	return query<AuctionTournamentRow>(
		`SELECT * FROM auction_tournaments WHERE status NOT IN ('COMPLETED', 'CANCELLED') AND deleted_at IS NULL ORDER BY started_at DESC`,
	);
}

export async function setAuctionEndCardMessage(
	id: number,
	channelId: string,
	messageId: string,
): Promise<void> {
	await execute(
		`UPDATE auction_tournaments SET end_card_channel_id = ?, end_card_message_id = ? WHERE id = ?`,
		[channelId, messageId, id],
	);
}
