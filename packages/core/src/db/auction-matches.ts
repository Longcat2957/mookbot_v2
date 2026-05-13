// v0.11.0: AUCTION 매치 — 독립 id + 독립 lifecycle (status / winning_team).
// 옛 구조는 series 와 1:1 (series_id PK) 였으나 id 풀 충돌 위험으로 분리.
// 게임은 games.auction_match_id FK 로 매달림.

import { execute, query, queryOne } from "../cloudflare/d1.js";

export type AuctionMatchRound = "SEMI" | "FINAL" | "SINGLE";
export type AuctionMatchFormat = "BO1" | "BO3";
export type AuctionMatchStatus = "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type AuctionMatchTeam = "TEAM_1" | "TEAM_2";

export interface AuctionMatchRow {
	id: number;
	tournament_id: number;
	round: AuctionMatchRound;
	bracket_index: number | null;
	team1_id: number;
	team2_id: number;
	format: AuctionMatchFormat;
	status: AuctionMatchStatus;
	winning_team: AuctionMatchTeam | null;
	started_at: number;
	ended_at: number | null;
	created_by: string | null;
	deleted_at: number | null;
}

/**
 * 토너먼트 매치 생성 — 자체 AUTOINCREMENT id 부여.
 * UNIQUE (tournament_id, round, bracket_index) 위반 시 throw — 운영자 안내.
 */
export async function createAuctionMatch(input: {
	tournamentId: number;
	round: AuctionMatchRound;
	bracketIndex: number | null;
	team1Id: number;
	team2Id: number;
	format: AuctionMatchFormat;
	createdBy: string;
}): Promise<AuctionMatchRow> {
	const [row] = await query<AuctionMatchRow>(
		`INSERT INTO auction_matches (tournament_id, round, bracket_index, team1_id, team2_id, format, created_by)
		 VALUES (?, ?, ?, ?, ?, ?, ?)
		 RETURNING *`,
		[
			input.tournamentId,
			input.round,
			input.bracketIndex,
			input.team1Id,
			input.team2Id,
			input.format,
			input.createdBy,
		],
	);
	if (!row) throw new Error("createAuctionMatch: insert failed");
	return row;
}

export async function getAuctionMatch(id: number): Promise<AuctionMatchRow | undefined> {
	return queryOne<AuctionMatchRow>(
		`SELECT * FROM auction_matches WHERE id = ? AND deleted_at IS NULL`,
		[id],
	);
}

export async function listAuctionMatches(tournamentId: number): Promise<AuctionMatchRow[]> {
	return query<AuctionMatchRow>(
		`SELECT * FROM auction_matches WHERE tournament_id = ? AND deleted_at IS NULL
		 ORDER BY CASE round WHEN 'SINGLE' THEN 0 WHEN 'SEMI' THEN 1 WHEN 'FINAL' THEN 2 END, bracket_index`,
		[tournamentId],
	);
}

export async function setAuctionMatchFormat(
	matchId: number,
	format: AuctionMatchFormat,
): Promise<void> {
	await execute(
		`UPDATE auction_matches SET format = ? WHERE id = ? AND deleted_at IS NULL`,
		[format, matchId],
	);
}

/**
 * 매치 종료 — BO1 / BO3 2승 도달 시. winning_team 기록 + status='COMPLETED'.
 */
export async function completeAuctionMatch(
	matchId: number,
	winningTeam: AuctionMatchTeam,
): Promise<void> {
	await execute(
		`UPDATE auction_matches
		 SET status = 'COMPLETED', winning_team = ?, ended_at = unixepoch()
		 WHERE id = ? AND deleted_at IS NULL`,
		[winningTeam, matchId],
	);
}

/**
 * 매치 결과 되돌리기 — 직전 게임 undo 후 매치가 COMPLETED 였으면 IN_PROGRESS 복원.
 */
export async function restoreAuctionMatchInProgress(matchId: number): Promise<void> {
	await execute(
		`UPDATE auction_matches
		 SET status = 'IN_PROGRESS', winning_team = NULL, ended_at = NULL
		 WHERE id = ? AND deleted_at IS NULL`,
		[matchId],
	);
}

export async function cancelAuctionMatch(matchId: number): Promise<void> {
	await execute(
		`UPDATE auction_matches
		 SET status = 'CANCELLED', ended_at = unixepoch()
		 WHERE id = ? AND status = 'IN_PROGRESS' AND deleted_at IS NULL`,
		[matchId],
	);
}
