// ============================================================
// 운영자 admin 작업 — 강제 삭제, MMR 수정, 시즌 리셋, audit
// ============================================================

import { batch, execute, query } from "../cloudflare/d1.js";
import type { Role } from "../mmr/elo.js";

// ============================================================
// Audit log
// ============================================================

export interface AuditEntry {
	operatorId: string;
	action: string;
	targetType?: string;
	targetId?: string;
	payload?: Record<string, unknown>;
	note?: string;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
	await execute(
		`INSERT INTO admin_audit_log (operator_id, action, target_type, target_id, payload, note)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		[
			entry.operatorId,
			entry.action,
			entry.targetType ?? null,
			entry.targetId ?? null,
			entry.payload ? JSON.stringify(entry.payload) : null,
			entry.note ?? null,
		],
	);
}

export interface AuditLogRow {
	id: number;
	operator_id: string;
	action: string;
	target_type: string | null;
	target_id: string | null;
	payload: string | null;
	note: string | null;
	created_at: number;
}

export interface ListAuditLogParams {
	action?: string;
	operatorId?: string;
	since?: number;
	until?: number;
	limit?: number;
	cursor?: number; // id < cursor (역시간 페이지네이션)
}

/**
 * audit log 페이지네이션 조회 — 최신순. cursor < id 로 다음 페이지.
 * limit 기본 50, 최대 200.
 */
export async function listAuditLog(params: ListAuditLogParams = {}): Promise<AuditLogRow[]> {
	const limit = Math.min(200, Math.max(1, params.limit ?? 50));
	const filters: string[] = [];
	const args: unknown[] = [];

	if (params.action) {
		filters.push("action = ?");
		args.push(params.action);
	}
	if (params.operatorId) {
		filters.push("operator_id = ?");
		args.push(params.operatorId);
	}
	if (params.since !== undefined) {
		filters.push("created_at >= ?");
		args.push(params.since);
	}
	if (params.until !== undefined) {
		filters.push("created_at < ?");
		args.push(params.until);
	}
	if (params.cursor !== undefined) {
		filters.push("id < ?");
		args.push(params.cursor);
	}
	const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
	args.push(limit);

	return query<AuditLogRow>(
		`SELECT id, operator_id, action, target_type, target_id, payload, note, created_at
		 FROM admin_audit_log
		 ${where}
		 ORDER BY id DESC
		 LIMIT ?`,
		args,
	);
}

/**
 * 사용 중인 distinct action 목록 — 필터 select 채울 때 사용.
 */
export async function listAuditActions(): Promise<string[]> {
	const rows = await query<{ action: string }>(
		`SELECT DISTINCT action FROM admin_audit_log ORDER BY action`,
	);
	return rows.map((r) => r.action);
}

/**
 * audit log retention — beforeUnixSec 이전 행 삭제. 삭제 수 반환.
 *
 * 호출자 책임으로 cutoff(= now - retention_days * 86400) 를 계산해서 넘긴다.
 * D1 단일 statement 삭제. 매우 큰 백로그(수만+ row) 가 쌓인 첫 prune 에서 timeout
 * 가능성이 있으나 일일 cron(C2) 기준으론 하루치만 처리하므로 사실상 무관.
 */
export async function pruneAuditLog(beforeUnixSec: number): Promise<{ deleted: number }> {
	const meta = await execute(`DELETE FROM admin_audit_log WHERE created_at < ?`, [beforeUnixSec]);
	return { deleted: meta.changes ?? 0 };
}

// ============================================================
// MMR 수동 보정
// ============================================================

export async function adjustLaneMmr(input: {
	userId: string;
	seasonId: number;
	role: Role;
	delta: number;
}): Promise<{ before: number; after: number }> {
	// upsert with delta applied. If row missing, baseline 1500.
	const existing = await query<{ mmr: number }>(
		`SELECT mmr FROM user_lane_mmr WHERE user_id = ? AND season_id = ? AND role = ?`,
		[input.userId, input.seasonId, input.role],
	);
	const before = existing[0]?.mmr ?? 1500;
	const after = before + input.delta;

	await execute(
		`INSERT INTO user_lane_mmr (user_id, season_id, role, mmr, games_played, wins, updated_at)
		 VALUES (?, ?, ?, ?, 0, 0, unixepoch())
		 ON CONFLICT(user_id, season_id, role) DO UPDATE SET
		   mmr = excluded.mmr,
		   updated_at = unixepoch()`,
		[input.userId, input.seasonId, input.role, after],
	);

	return { before, after };
}

// ============================================================
// 시즌 결과 리셋
// ============================================================

export interface SeasonResetSummary {
	seasonId: number;
	seriesCount: number;
	gamesCount: number;
	mmrChangesCount: number;
	laneMmrCount: number;
}

export async function inspectSeasonForReset(seasonId: number): Promise<SeasonResetSummary> {
	const [{ n: seriesCount } = { n: 0 }] = await query<{ n: number }>(
		`SELECT COUNT(*) AS n FROM series WHERE season_id = ? AND deleted_at IS NULL`,
		[seasonId],
	);
	const [{ n: gamesCount } = { n: 0 }] = await query<{ n: number }>(
		`SELECT COUNT(*) AS n FROM games g JOIN series s ON s.id = g.ranked_series_id
		 WHERE s.season_id = ? AND s.deleted_at IS NULL`,
		[seasonId],
	);
	const [{ n: mmrChangesCount } = { n: 0 }] = await query<{ n: number }>(
		`SELECT COUNT(*) AS n FROM mmr_changes WHERE season_id = ?`,
		[seasonId],
	);
	const [{ n: laneMmrCount } = { n: 0 }] = await query<{ n: number }>(
		`SELECT COUNT(*) AS n FROM user_lane_mmr WHERE season_id = ?`,
		[seasonId],
	);
	return { seasonId, seriesCount, gamesCount, mmrChangesCount, laneMmrCount };
}

/**
 * 시즌의 모든 시리즈/게임/MMR 데이터 리셋. 시즌 row 자체는 유지.
 *
 * series 는 soft-delete (deleted_at = unixepoch()) — 모든 read 쿼리에서 가려짐.
 * user_lane_mmr / mmr_changes 는 hard-delete — 누적 카운터는 진짜 0 으로 돌려야 의미가 있음.
 */
export async function resetSeasonData(seasonId: number): Promise<SeasonResetSummary> {
	const summary = await inspectSeasonForReset(seasonId);
	await batch([
		// 이 시즌 series 를 참조하는 recruit 의 converted_series_id 풀어줌
		{
			sql: `UPDATE recruitments SET converted_series_id = NULL
			      WHERE converted_series_id IN (SELECT id FROM series WHERE season_id = ?)`,
			params: [seasonId],
		},
		// series 는 soft-delete — 모든 read 쿼리에서 가려짐
		{
			sql: `UPDATE series SET deleted_at = unixepoch() WHERE season_id = ? AND deleted_at IS NULL`,
			params: [seasonId],
		},
		// user_lane_mmr 는 시즌 직접 참조, hard-delete (누적 0 으로 진짜 리셋)
		{ sql: `DELETE FROM user_lane_mmr WHERE season_id = ?`, params: [seasonId] },
		// mmr_changes 도 hard-delete (시즌 직접 참조)
		{ sql: `DELETE FROM mmr_changes WHERE season_id = ?`, params: [seasonId] },
	]);
	return summary;
}

export interface SeriesImpactSummary {
	seriesId: number;
	gamesCount: number;
	participants: number;
	mmrChanges: number;
	rollbackPlan: Array<{
		userId: string;
		seasonId: number;
		role: Role;
		totalDelta: number;
		gamesPlayed: number;
		wins: number;
	}>;
	/**
	 * 이 시리즈의 영향을 받은 (user, season, role) 조합이 이후 시리즈에서 추가 게임을
	 * 가진 누적 카운트. > 0 이면 rollback 후 user_lane_mmr 가 "S1 이 없었다면" 의
	 * 값과 미세하게 drift 한다 (subsequent 게임의 ELO 가 옛 baseline 으로 계산됨).
	 * audit / 운영자 경고용.
	 */
	subsequentGames: number;
}

/**
 * 시리즈 강제 삭제 전 영향 요약 — 미리보기용. soft-deleted 시리즈도 포함 (admin 시야).
 */
export async function inspectSeriesForDelete(seriesId: number): Promise<SeriesImpactSummary> {
	const [{ n: gamesCount } = { n: 0 }] = await query<{ n: number }>(
		`SELECT COUNT(*) AS n FROM games g JOIN series s ON s.id = g.ranked_series_id
		 WHERE g.ranked_series_id = ? AND s.deleted_at IS NULL`,
		[seriesId],
	);
	const [{ n: participants } = { n: 0 }] = await query<{ n: number }>(
		`SELECT COUNT(*) AS n FROM series_participants WHERE series_id = ?`,
		[seriesId],
	);
	const [{ n: mmrChanges } = { n: 0 }] = await query<{ n: number }>(
		`SELECT COUNT(*) AS n FROM mmr_changes mc JOIN games g ON g.id = mc.game_id
		 JOIN series s ON s.id = g.ranked_series_id
		 WHERE g.ranked_series_id = ? AND s.deleted_at IS NULL`,
		[seriesId],
	);

	const aggregated = await query<{
		user_id: string;
		season_id: number;
		role: Role;
		total_delta: number;
		games_played: number;
		wins: number;
	}>(
		`SELECT
		    mc.user_id,
		    mc.season_id,
		    mc.role,
		    SUM(mc.delta) AS total_delta,
		    COUNT(*) AS games_played,
		    SUM(CASE WHEN mc.delta > 0 THEN 1 ELSE 0 END) AS wins
		 FROM mmr_changes mc
		 JOIN games g ON g.id = mc.game_id
		 JOIN series s ON s.id = g.ranked_series_id
		 WHERE g.ranked_series_id = ? AND s.deleted_at IS NULL
		 GROUP BY mc.user_id, mc.season_id, mc.role`,
		[seriesId],
	);

	// 후속 게임 카운트 — 이 시리즈에 영향 받은 (user, season, role) 들이 더 최근
	// 시리즈에서 가진 추가 mmr_changes 행. > 0 이면 rollback 후 미세 drift.
	// 같은 시리즈의 게임은 제외 (game_id != IN this series's games).
	let subsequentGames = 0;
	if (aggregated.length > 0) {
		const placeholders = aggregated.map(() => "(?, ?, ?)").join(", ");
		const args: unknown[] = [];
		for (const a of aggregated) args.push(a.user_id, a.season_id, a.role);
		args.push(seriesId);
		const [row] = await query<{ n: number }>(
			`SELECT COUNT(*) AS n
			 FROM mmr_changes mc
			 JOIN games g ON g.id = mc.game_id
			 JOIN series s ON s.id = g.ranked_series_id
			 WHERE (mc.user_id, mc.season_id, mc.role) IN (${placeholders})
			   AND g.ranked_series_id != ?
			   AND s.deleted_at IS NULL`,
			args,
		);
		subsequentGames = row?.n ?? 0;
	}

	return {
		seriesId,
		gamesCount,
		participants,
		mmrChanges,
		subsequentGames,
		rollbackPlan: aggregated.map((a) => ({
			userId: a.user_id,
			seasonId: a.season_id,
			role: a.role,
			totalDelta: a.total_delta,
			gamesPlayed: a.games_played,
			wins: a.wins,
		})),
	};
}

/**
 * 시리즈 soft-delete + 선택적 user_lane_mmr 누적값 롤백.
 *
 * 주의: 후속 게임이 있을 경우 이 시리즈 게임의 영향만 차감 — 후속 ELO 는 그대로 둠.
 *       엄밀히 정확하려면 후속 게임도 재계산 필요하나, 운영 응급용이라 단순 차감 채택.
 *       후속 게임 카운트는 `subsequentGames` 로 반환 — operator 가 drift 위험을
 *       audit 로 인지할 수 있도록.
 *
 * v3: hard-delete → soft-delete 로 변경. 종속 game_stats / picks / bans / mmr_changes
 * 행은 그대로 유지되지만 read 쿼리들이 series.deleted_at IS NULL 필터로 가려준다.
 * 진짜 물리 삭제가 필요하면 별도 purgeSeries 호출.
 */
export async function forceDeleteSeriesWithRollback(
	seriesId: number,
	rollbackMmr: boolean,
): Promise<{
	rollbackRows: number;
	subsequentGames: number;
	gamesCount: number;
	participants: number;
	mmrChanges: number;
}> {
	const summary = await inspectSeriesForDelete(seriesId);

	let rollbackRows = 0;
	if (rollbackMmr && summary.rollbackPlan.length > 0) {
		const stmts = summary.rollbackPlan.map((p) => ({
			sql: `UPDATE user_lane_mmr SET
			        mmr = mmr - ?,
			        games_played = MAX(0, games_played - ?),
			        wins = MAX(0, wins - ?),
			        updated_at = unixepoch()
			      WHERE user_id = ? AND season_id = ? AND role = ?`,
			params: [p.totalDelta, p.gamesPlayed, p.wins, p.userId, p.seasonId, p.role] as unknown[],
		}));
		await batch(stmts);
		rollbackRows = stmts.length;
	}

	// 모집의 converted_series_id 풀어줌 — 이 모집이 새로 엔트리 확정 가능하게.
	await execute(`UPDATE recruitments SET converted_series_id = NULL WHERE converted_series_id = ?`, [
		seriesId,
	]);

	// soft-delete — read 쿼리에서 가려짐. 같은 id 로 createSeries 시 (gamesCount===0 일 때만) revive.
	await execute(`UPDATE series SET deleted_at = unixepoch() WHERE id = ? AND deleted_at IS NULL`, [
		seriesId,
	]);

	return {
		rollbackRows,
		subsequentGames: summary.subsequentGames,
		gamesCount: summary.gamesCount,
		participants: summary.participants,
		mmrChanges: summary.mmrChanges,
	};
}
