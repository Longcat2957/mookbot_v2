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
	// soft-delete 된 행 있으면 revive (모집 ID 동일하게 다시 만드는 경로)
	const existing = await queryOne<AuctionTournamentRow>(
		`SELECT * FROM auction_tournaments WHERE id = ?`,
		[input.id],
	);
	if (existing && existing.deleted_at == null) {
		throw new Error(
			`createAuctionTournament: 토너먼트 #${input.id} 이미 존재 (status=${existing.status})`,
		);
	}
	if (existing && existing.deleted_at != null) {
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
	// 종속 시리즈 (status 무관) 도 함께 soft-delete — cancel 단계는 historical 보존,
	// softDelete 는 "완전히 사라짐" 의미. 누락 시 series.id 회수 흐름 (RANKED 모집 ID
	// 동일 부여) 에서 createSeries 가 deleted_at IS NULL 행과 충돌해 실패한다.
	await execute(
		`UPDATE series SET deleted_at = unixepoch() WHERE auction_tournament_id = ? AND deleted_at IS NULL`,
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
