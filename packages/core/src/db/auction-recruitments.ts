// 경매내전 모집 — 일반 recruitments 와 구조 유사하나 별도 테이블 (lifecycle 다름).
// 정원은 10 또는 20 만, 라인 선호 입력 없음 (경매에서 결정).

import { execute, query, queryOne } from "../cloudflare/d1.js";

export type AuctionRecruitmentStatus = "OPEN" | "CLOSED" | "CONVERTED" | "CANCELLED";
export type AuctionFormat = 10 | 20;

export interface AuctionRecruitmentRow {
	id: number;
	season_id: number;
	target_count: AuctionFormat;
	status: AuctionRecruitmentStatus;
	converted_tournament_id: number | null;
	created_by: string;
	channel_id: string | null;
	message_id: string | null;
	created_at: number;
	updated_at: number;
}

export interface AuctionRecruitmentParticipantRow {
	recruitment_id: number;
	user_id: string;
	joined_at: number;
}

export async function createAuctionRecruitment(input: {
	seasonId: number;
	targetCount: AuctionFormat;
	createdBy: string;
	channelId?: string;
	messageId?: string;
}): Promise<AuctionRecruitmentRow> {
	const [row] = await query<AuctionRecruitmentRow>(
		`INSERT INTO auction_recruitments (season_id, target_count, created_by, channel_id, message_id)
		 VALUES (?, ?, ?, ?, ?)
		 RETURNING *`,
		[
			input.seasonId,
			input.targetCount,
			input.createdBy,
			input.channelId ?? null,
			input.messageId ?? null,
		],
	);
	if (!row) throw new Error("createAuctionRecruitment: insert failed");
	return row;
}

export async function getAuctionRecruitment(
	id: number,
): Promise<AuctionRecruitmentRow | undefined> {
	return queryOne<AuctionRecruitmentRow>(`SELECT * FROM auction_recruitments WHERE id = ?`, [id]);
}

export async function setAuctionRecruitmentMessage(
	id: number,
	channelId: string,
	messageId: string,
): Promise<void> {
	await execute(
		`UPDATE auction_recruitments SET channel_id = ?, message_id = ?, updated_at = unixepoch() WHERE id = ?`,
		[channelId, messageId, id],
	);
}

export async function setAuctionRecruitmentStatus(
	id: number,
	status: AuctionRecruitmentStatus,
	convertedTournamentId?: number,
): Promise<void> {
	await execute(
		`UPDATE auction_recruitments SET status = ?, converted_tournament_id = ?, updated_at = unixepoch() WHERE id = ?`,
		[status, convertedTournamentId ?? null, id],
	);
}

export async function deleteAuctionRecruitment(id: number): Promise<void> {
	await execute(`DELETE FROM auction_recruitments WHERE id = ?`, [id]);
}

export async function listOpenAuctionRecruitments(): Promise<AuctionRecruitmentRow[]> {
	return query<AuctionRecruitmentRow>(
		`SELECT * FROM auction_recruitments WHERE status = 'OPEN' ORDER BY created_at DESC`,
	);
}

/**
 * Activity 대시보드용 — 진행 중인 모든 경매 (OPEN / CLOSED / CONVERTED).
 * - OPEN: 모집 중
 * - CLOSED: 운영자 [▶ 경매 시작] 대기 (Activity 진입 가능)
 * - CONVERTED: 토너먼트 진행 중 (Activity 가 토너먼트 화면으로 라우팅)
 *
 * 일반 내전과 일관 — listBuildableRecruitments 와 동등 의미.
 */
export async function listActiveAuctionRecruitments(): Promise<AuctionRecruitmentRow[]> {
	return query<AuctionRecruitmentRow>(
		`SELECT * FROM auction_recruitments WHERE status IN ('OPEN', 'CLOSED', 'CONVERTED') ORDER BY created_at DESC`,
	);
}

export async function listCancellableAuctionRecruitments(): Promise<AuctionRecruitmentRow[]> {
	return query<AuctionRecruitmentRow>(
		`SELECT * FROM auction_recruitments WHERE status IN ('OPEN', 'CLOSED') ORDER BY created_at DESC`,
	);
}

export async function listStaleOpenAuctionRecruitments(
	cutoffUnixSec: number,
): Promise<AuctionRecruitmentRow[]> {
	return query<AuctionRecruitmentRow>(
		`SELECT * FROM auction_recruitments WHERE status = 'OPEN' AND created_at < ? ORDER BY created_at`,
		[cutoffUnixSec],
	);
}

// ============================================================
// participants
// ============================================================

export async function addAuctionRecruitmentParticipant(input: {
	recruitmentId: number;
	userId: string;
}): Promise<void> {
	await execute(
		`INSERT INTO auction_recruitment_participants (recruitment_id, user_id)
		 VALUES (?, ?)
		 ON CONFLICT(recruitment_id, user_id) DO NOTHING`,
		[input.recruitmentId, input.userId],
	);
}

export async function removeAuctionRecruitmentParticipant(
	recruitmentId: number,
	userId: string,
): Promise<void> {
	await execute(
		`DELETE FROM auction_recruitment_participants WHERE recruitment_id = ? AND user_id = ?`,
		[recruitmentId, userId],
	);
}

export async function listAuctionRecruitmentParticipants(
	recruitmentId: number,
): Promise<AuctionRecruitmentParticipantRow[]> {
	return query<AuctionRecruitmentParticipantRow>(
		`SELECT * FROM auction_recruitment_participants WHERE recruitment_id = ? ORDER BY joined_at`,
		[recruitmentId],
	);
}

export async function isAuctionRecruitmentParticipant(
	recruitmentId: number,
	userId: string,
): Promise<boolean> {
	const row = await queryOne<{ user_id: string }>(
		`SELECT user_id FROM auction_recruitment_participants WHERE recruitment_id = ? AND user_id = ?`,
		[recruitmentId, userId],
	);
	return !!row;
}
