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
		`SELECT COUNT(*) AS n FROM series WHERE season_id = ?`,
		[seasonId],
	);
	const [{ n: gamesCount } = { n: 0 }] = await query<{ n: number }>(
		`SELECT COUNT(*) AS n FROM games g JOIN series s ON s.id = g.series_id WHERE s.season_id = ?`,
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
 * 시즌의 모든 시리즈/게임/MMR 데이터 삭제. 시즌 row 자체는 유지.
 */
export async function resetSeasonData(seasonId: number): Promise<SeasonResetSummary> {
	const summary = await inspectSeasonForReset(seasonId);
	await batch([
		// recruitments.converted_series_id 는 ON DELETE 정책이 없어서 먼저 SET NULL.
		// (이 시즌의 series 를 참조하는 recruit 만 풀어줌)
		{
			sql: `UPDATE recruitments SET converted_series_id = NULL
			      WHERE converted_series_id IN (SELECT id FROM series WHERE season_id = ?)`,
			params: [seasonId],
		},
		// CASCADE: series → series_participants, games → game_stats, mmr_changes
		{ sql: `DELETE FROM series WHERE season_id = ?`, params: [seasonId] },
		// user_lane_mmr 는 시즌 직접 참조, 별도 삭제
		{ sql: `DELETE FROM user_lane_mmr WHERE season_id = ?`, params: [seasonId] },
		// 안전망: 혹시 시즌 직접 참조하는 mmr_changes (CASCADE 못 탄 것)
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
}

/**
 * 시리즈 강제 삭제 전 영향 요약 — 미리보기용.
 */
export async function inspectSeriesForDelete(seriesId: number): Promise<SeriesImpactSummary> {
	const [{ n: gamesCount } = { n: 0 }] = await query<{ n: number }>(
		`SELECT COUNT(*) AS n FROM games WHERE series_id = ?`,
		[seriesId],
	);
	const [{ n: participants } = { n: 0 }] = await query<{ n: number }>(
		`SELECT COUNT(*) AS n FROM series_participants WHERE series_id = ?`,
		[seriesId],
	);
	const [{ n: mmrChanges } = { n: 0 }] = await query<{ n: number }>(
		`SELECT COUNT(*) AS n FROM mmr_changes mc JOIN games g ON g.id = mc.game_id WHERE g.series_id = ?`,
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
		 WHERE g.series_id = ?
		 GROUP BY mc.user_id, mc.season_id, mc.role`,
		[seriesId],
	);

	return {
		seriesId,
		gamesCount,
		participants,
		mmrChanges,
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
 * 시리즈 + 종속 데이터 물리 삭제, 선택적으로 user_lane_mmr 누적값을 되돌림.
 *
 * 주의: 후속 게임이 있을 경우 이 시리즈 게임의 영향만 차감 — 후속 ELO 는 그대로 둠.
 *       엄밀히 정확하려면 후속 게임도 재계산 필요하나, 운영 응급용이라 단순 차감 채택.
 */
export async function forceDeleteSeriesWithRollback(
	seriesId: number,
	rollbackMmr: boolean,
): Promise<{ rollbackRows: number }> {
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

	// recruitments.converted_series_id 는 REFERENCES series(id) 인데 ON DELETE 정책이
	// 없어서 series 삭제 시 FK 위반 (SQLITE_CONSTRAINT_FOREIGNKEY). 먼저 SET NULL.
	await execute(
		`UPDATE recruitments SET converted_series_id = NULL WHERE converted_series_id = ?`,
		[seriesId],
	);

	// CASCADE 로 series_participants / games / game_stats / mmr_changes 모두 삭제됨
	await execute(`DELETE FROM series WHERE id = ?`, [seriesId]);

	return { rollbackRows };
}
