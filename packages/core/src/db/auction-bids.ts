// 경매 입찰 audit — 운영자가 보이스로 받은 최종 입찰만 기록.
// is_final=1 은 낙찰 입찰 (해당 target 이 그 team 에 배치된 입찰).
// 중간 입찰은 audit X (Q5 결정).

import { execute, query } from "../cloudflare/d1.js";

export interface AuctionBidRow {
	id: number;
	tournament_id: number;
	target_user_id: string;
	team_id: number;
	points: number;
	is_final: 0 | 1;
	created_at: number;
}

export async function recordAuctionBid(input: {
	tournamentId: number;
	targetUserId: string;
	teamId: number;
	points: number;
	isFinal: boolean;
}): Promise<AuctionBidRow> {
	const [row] = await query<AuctionBidRow>(
		`INSERT INTO auction_bids (tournament_id, target_user_id, team_id, points, is_final)
		 VALUES (?, ?, ?, ?, ?)
		 RETURNING *`,
		[input.tournamentId, input.targetUserId, input.teamId, input.points, input.isFinal ? 1 : 0],
	);
	if (!row) throw new Error("recordAuctionBid: insert failed");
	return row;
}

export async function listAuctionBids(tournamentId: number): Promise<AuctionBidRow[]> {
	return query<AuctionBidRow>(
		`SELECT * FROM auction_bids WHERE tournament_id = ? ORDER BY created_at DESC`,
		[tournamentId],
	);
}

export async function listAuctionBidsForTarget(
	tournamentId: number,
	targetUserId: string,
): Promise<AuctionBidRow[]> {
	return query<AuctionBidRow>(
		`SELECT * FROM auction_bids WHERE tournament_id = ? AND target_user_id = ? ORDER BY created_at DESC`,
		[tournamentId, targetUserId],
	);
}

/**
 * 낙찰 취소 — 매물 단위 되돌리기 (Q15). 해당 target 의 모든 입찰 기록 DELETE.
 * caller 가 team_members 제거 + 포인트 복원 별도 처리.
 */
export async function deleteAuctionBidsForTarget(
	tournamentId: number,
	targetUserId: string,
): Promise<void> {
	await execute(`DELETE FROM auction_bids WHERE tournament_id = ? AND target_user_id = ?`, [
		tournamentId,
		targetUserId,
	]);
}
