import { batch, execute, query, queryOne } from "../cloudflare/d1.js";
import type { Role } from "../mmr/elo.js";

export type RecruitmentStatus = "OPEN" | "CLOSED" | "CONVERTED" | "CANCELLED";
export type RoleSlot = Role; // AUTOFILL 제거 — 빈 roles[] 가 그 역할
export const ROLE_SLOTS: readonly RoleSlot[] = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"];

export interface RecruitmentRow {
	id: number;
	season_id: number;
	target_count: number;
	status: RecruitmentStatus;
	converted_series_id: number | null;
	created_by: string;
	channel_id: string | null;
	message_id: string | null;
	created_at: number;
	updated_at: number;
}

/**
 * 참가자 한 명 + 본인이 선택한 선호 라인들. roles 가 비어있으면 라인 무관.
 */
export interface RecruitmentParticipantWithRoles {
	recruitment_id: number;
	user_id: string;
	joined_at: number;
	roles: RoleSlot[];
}

export async function createRecruitment(input: {
	seasonId: number;
	targetCount: number;
	createdBy: string;
	channelId?: string;
	messageId?: string;
}): Promise<RecruitmentRow> {
	const [row] = await query<RecruitmentRow>(
		`INSERT INTO recruitments (season_id, target_count, created_by, channel_id, message_id)
		 VALUES (?, ?, ?, ?, ?)
		 RETURNING *`,
		[input.seasonId, input.targetCount, input.createdBy, input.channelId ?? null, input.messageId ?? null],
	);
	if (!row) throw new Error("createRecruitment: insert failed");
	return row;
}

export async function getRecruitment(id: number): Promise<RecruitmentRow | undefined> {
	return queryOne<RecruitmentRow>(`SELECT * FROM recruitments WHERE id = ?`, [id]);
}

export async function setRecruitmentMessage(id: number, channelId: string, messageId: string): Promise<void> {
	await execute(
		`UPDATE recruitments SET channel_id = ?, message_id = ?, updated_at = unixepoch() WHERE id = ?`,
		[channelId, messageId, id],
	);
}

export async function setRecruitmentStatus(
	id: number,
	status: RecruitmentStatus,
	convertedSeriesId?: number,
): Promise<void> {
	await execute(
		`UPDATE recruitments SET status = ?, converted_series_id = ?, updated_at = unixepoch() WHERE id = ?`,
		[status, convertedSeriesId ?? null, id],
	);
}

/**
 * 모집을 물리 삭제 — 운영자 [강제 마감] 시 "없었던 것으로" 처리.
 * recruitment_participants / recruitment_role_prefs 는 ON DELETE CASCADE 로 자동 정리.
 */
export async function deleteRecruitment(id: number): Promise<void> {
	await execute(`DELETE FROM recruitments WHERE id = ?`, [id]);
}

export async function listOpenRecruitments(): Promise<RecruitmentRow[]> {
	return query<RecruitmentRow>(`SELECT * FROM recruitments WHERE status = 'OPEN' ORDER BY created_at DESC`);
}

/**
 * 운영자가 취소할 수 있는 모집 — OPEN 또는 CLOSED (CONVERTED/CANCELLED 제외).
 */
export async function listCancellableRecruitments(): Promise<RecruitmentRow[]> {
	return query<RecruitmentRow>(
		`SELECT * FROM recruitments WHERE status IN ('OPEN', 'CLOSED') ORDER BY created_at DESC`,
	);
}

/**
 * OPEN 상태로 `cutoffUnixSec` 이전에 만들어진 오래된 모집.
 */
export async function listStaleOpenRecruitments(cutoffUnixSec: number): Promise<RecruitmentRow[]> {
	return query<RecruitmentRow>(
		`SELECT * FROM recruitments WHERE status = 'OPEN' AND created_at < ? ORDER BY created_at`,
		[cutoffUnixSec],
	);
}

/**
 * 팀짜기 자동완성용 — 아직 시리즈로 변환되지 않은 모집(OPEN 또는 CLOSED).
 */
export async function listBuildableRecruitments(): Promise<RecruitmentRow[]> {
	return query<RecruitmentRow>(
		`SELECT * FROM recruitments WHERE status IN ('OPEN', 'CLOSED') ORDER BY created_at DESC`,
	);
}

// ============================================================
// participants + roles (separate table)
// ============================================================

export async function addRecruitmentParticipant(input: {
	recruitmentId: number;
	userId: string;
}): Promise<void> {
	await execute(
		`INSERT INTO recruitment_participants (recruitment_id, user_id)
		 VALUES (?, ?)
		 ON CONFLICT(recruitment_id, user_id) DO NOTHING`,
		[input.recruitmentId, input.userId],
	);
}

export async function removeRecruitmentParticipant(recruitmentId: number, userId: string): Promise<void> {
	// ON DELETE CASCADE 가 roles 도 정리
	await execute(
		`DELETE FROM recruitment_participants WHERE recruitment_id = ? AND user_id = ?`,
		[recruitmentId, userId],
	);
}

export async function setRecruitmentRoles(
	recruitmentId: number,
	userId: string,
	roles: ReadonlyArray<RoleSlot>,
): Promise<void> {
	const stmts = [
		{
			sql: `DELETE FROM recruitment_participant_roles WHERE recruitment_id = ? AND user_id = ?`,
			params: [recruitmentId, userId] as unknown[],
		},
	];
	if (roles.length > 0) {
		const placeholders = roles.map(() => "(?, ?, ?)").join(", ");
		const params: unknown[] = [];
		for (const r of roles) params.push(recruitmentId, userId, r);
		stmts.push({
			sql: `INSERT INTO recruitment_participant_roles (recruitment_id, user_id, role) VALUES ${placeholders}`,
			params,
		});
	}
	await batch(stmts);
}

export async function listRecruitmentParticipants(
	recruitmentId: number,
): Promise<RecruitmentParticipantWithRoles[]> {
	const rows = await query<{
		user_id: string;
		joined_at: number;
		roles_csv: string | null;
	}>(
		`SELECT
		    rp.user_id,
		    rp.joined_at,
		    GROUP_CONCAT(rpr.role) AS roles_csv
		 FROM recruitment_participants rp
		 LEFT JOIN recruitment_participant_roles rpr
		    ON rpr.recruitment_id = rp.recruitment_id AND rpr.user_id = rp.user_id
		 WHERE rp.recruitment_id = ?
		 GROUP BY rp.user_id, rp.joined_at
		 ORDER BY rp.joined_at`,
		[recruitmentId],
	);
	return rows.map((r) => ({
		recruitment_id: recruitmentId,
		user_id: r.user_id,
		joined_at: r.joined_at,
		roles: r.roles_csv ? (r.roles_csv.split(",") as RoleSlot[]) : [],
	}));
}

export async function isRecruitmentParticipant(recruitmentId: number, userId: string): Promise<boolean> {
	const row = await queryOne<{ user_id: string }>(
		`SELECT user_id FROM recruitment_participants WHERE recruitment_id = ? AND user_id = ?`,
		[recruitmentId, userId],
	);
	return !!row;
}
