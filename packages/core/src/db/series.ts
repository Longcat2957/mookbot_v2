import { execute, query, queryOne } from "../cloudflare/d1.js";
import type { Role, Team } from "../mmr/elo.js";
import { multiInsert } from "./sql.js";

export type { Role, Team };
export type SeriesStatus = "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface SeriesRow {
	id: number;
	season_id: number;
	status: SeriesStatus;
	winning_team: Team | null;
	started_at: number;
	ended_at: number | null;
	created_by: string | null;
	channel_id: string | null;
	message_id: string | null;
	end_card_channel_id: string | null;
	end_card_message_id: string | null;
	deleted_at: number | null;
}

export interface SeriesParticipantRow {
	series_id: number;
	user_id: string;
	team: Team;
	role: Role;
}

export interface CreateSeriesInput {
	/**
	 * 시리즈 ID — 운영 흐름은 모집 ID 와 동일하게 명시 부여한다 (사용자 혼동 방지).
	 * 미지정 시 AUTOINCREMENT 가 부여 (seed / 테스트 fallback).
	 */
	id?: number;
	seasonId: number;
	createdBy: string;
	participants: ReadonlyArray<{ userId: string; team: Team; role: Role }>;
}

/**
 * Bo3 시리즈 생성. 1v1 ~ 5v5 까지 N v N 지원 (참가자 = 짝수, 2~10).
 * 양 팀 라인 수 일치 + 같은 라인이 양 팀에 존재해야 라인 매치업 ELO 가능.
 *
 * 같은 id 의 행이 revive 가능하면 자동 revive (상태 초기화 + 참가자 교체):
 *   - soft-deleted (deleted_at != NULL) 행, 또는 CANCELLED 행
 *   - 단, 게임이 0개일 때만 — /api/series/:id/revert 또는 빈 IN_PROGRESS 의 force-delete 직후
 * 게임이 1개라도 기록된 행은 soft-delete 든 CANCELLED 든 revive 거부 (history 보존).
 * 이 invariant 가 깨지면 force-delete + same-id 재생성 시 orphan games/mmr_changes 가
 * 새 시리즈에 붙어 데이터 corruption.
 *
 * 비-atomic: series + series_participants 가 분리 트랜잭션. participant insert 실패 시
 * series row 가 IN_PROGRESS 0인 으로 남음 — cleanup 잡이 정리.
 */
export async function createSeries(input: CreateSeriesInput): Promise<SeriesRow> {
	const n = input.participants.length;
	if (n < 2 || n > 10 || n % 2 !== 0) {
		throw new Error(`createSeries: 참가자 수 ${n} — 2~10 짝수 (1v1 ~ 5v5) 만 지원`);
	}
	const t1 = input.participants.filter((p) => p.team === "TEAM_1");
	const t2 = input.participants.filter((p) => p.team === "TEAM_2");
	if (t1.length !== t2.length) {
		throw new Error(`createSeries: 팀 크기 불일치 (TEAM_1=${t1.length}, TEAM_2=${t2.length})`);
	}
	const t1Roles = new Set(t1.map((p) => p.role));
	const t2Roles = new Set(t2.map((p) => p.role));
	if (t1Roles.size !== t1.length) {
		throw new Error("createSeries: TEAM_1 내 라인 중복");
	}
	if (t2Roles.size !== t2.length) {
		throw new Error("createSeries: TEAM_2 내 라인 중복");
	}
	for (const r of t1Roles) {
		if (!t2Roles.has(r)) {
			throw new Error(
				`createSeries: ${r} 라인 매치업 없음 — 양 팀에 같은 라인이 있어야 ELO 계산 가능`,
			);
		}
	}

	let series: SeriesRow | undefined;
	if (input.id !== undefined) {
		// 명시 id 경로 — soft-deleted 또는 CANCELLED 인 빈 시리즈만 재사용. 살아있는 행 or
		// 게임이 1개라도 기록된 historical 행과 충돌이면 에러.
		// (v0.11.0: AUCTION 매치는 auction_matches 로 분리됐으므로 cross-type 가드 불필요.)
		const existing = await queryOne<SeriesRow>(`SELECT * FROM series WHERE id = ?`, [input.id]);
		let canRevive = false;
		if (existing && (existing.deleted_at != null || existing.status === "CANCELLED")) {
			// 게임이 0개일 때만 revive — soft-delete 든 CANCELLED 든 historical row 는 revive 거부.
			// force-delete 후 same-id 재생성 시 orphan games/mmr_changes 가 새 시리즈에 attach 되는
			// corruption 방지.
			const gameCount = await queryOne<{ n: number }>(
				`SELECT COUNT(*) AS n FROM games WHERE ranked_series_id = ?`,
				[input.id],
			);
			if ((gameCount?.n ?? 0) === 0) canRevive = true;
		}
		if (existing && !canRevive) {
			throw new Error(
				`createSeries: 시리즈 #${input.id} 가 이미 존재합니다 (status=${existing.status})`,
			);
		}
		if (existing && canRevive) {
			// revive — 상태 초기화 + 기존 참가자 정리 (아래에서 다시 INSERT)
			await execute(
				`UPDATE series
				 SET season_id = ?, status = 'IN_PROGRESS', winning_team = NULL,
				     started_at = unixepoch(), ended_at = NULL, created_by = ?,
				     channel_id = NULL, message_id = NULL,
				     activity_instance_id = NULL, activity_started_at = NULL,
				     end_card_message_id = NULL, end_card_channel_id = NULL,
				     deleted_at = NULL
				 WHERE id = ?`,
				[input.seasonId, input.createdBy, input.id],
			);
			await execute(`DELETE FROM series_participants WHERE series_id = ?`, [input.id]);
			series = await queryOne<SeriesRow>(`SELECT * FROM series WHERE id = ?`, [input.id]);
		} else {
			[series] = await query<SeriesRow>(
				`INSERT INTO series (id, season_id, created_by) VALUES (?, ?, ?) RETURNING *`,
				[input.id, input.seasonId, input.createdBy],
			);
		}
	} else {
		// AUTOINCREMENT fallback (seed / 테스트)
		[series] = await query<SeriesRow>(
			`INSERT INTO series (season_id, created_by) VALUES (?, ?) RETURNING *`,
			[input.seasonId, input.createdBy],
		);
	}
	if (!series) throw new Error("createSeries: failed to insert series");

	const insert = multiInsert(
		"series_participants",
		["series_id", "user_id", "team", "role"],
		input.participants.map((p) => [series.id, p.userId, p.team, p.role]),
	);
	await execute(insert.sql, insert.params);

	return series;
}

export async function getSeries(id: number): Promise<SeriesRow | undefined> {
	return queryOne<SeriesRow>(`SELECT * FROM series WHERE id = ? AND deleted_at IS NULL`, [id]);
}

/**
 * soft-deleted 포함 조회 — admin / audit 용. 일반 흐름은 getSeries 사용.
 */
export async function getSeriesIncludingDeleted(id: number): Promise<SeriesRow | undefined> {
	return queryOne<SeriesRow>(`SELECT * FROM series WHERE id = ?`, [id]);
}

export async function getSeriesParticipants(seriesId: number): Promise<SeriesParticipantRow[]> {
	return query<SeriesParticipantRow>(`SELECT * FROM series_participants WHERE series_id = ?`, [
		seriesId,
	]);
}

export async function completeSeries(id: number, winningTeam: Team): Promise<void> {
	await execute(
		`UPDATE series SET status = 'COMPLETED', winning_team = ?, ended_at = unixepoch()
		 WHERE id = ? AND status = 'IN_PROGRESS' AND deleted_at IS NULL`,
		[winningTeam, id],
	);
}

export async function cancelSeries(id: number): Promise<void> {
	await execute(
		`UPDATE series SET status = 'CANCELLED', ended_at = unixepoch()
		 WHERE id = ? AND status = 'IN_PROGRESS' AND deleted_at IS NULL`,
		[id],
	);
}

// v0.11.0: series 는 RANKED 전용 — type 필터 불필요. 경매내전 매치는 auction_matches.
export async function listAllOpenSeries(): Promise<SeriesRow[]> {
	return query<SeriesRow>(
		`SELECT * FROM series WHERE status = 'IN_PROGRESS' AND deleted_at IS NULL ORDER BY started_at DESC`,
	);
}

export interface ListSeriesParams {
	status?: SeriesStatus;
	seasonId?: number;
	limit?: number;
}

/**
 * 시리즈 일반 listing — /시리즈목록 등에서 사용. 최신순 (started_at DESC).
 * status 미지정 시 모든 상태 포함. limit 기본 10, 최대 50.
 * soft-deleted (deleted_at != NULL) 행은 항상 제외.
 */
export async function listSeries(params: ListSeriesParams = {}): Promise<SeriesRow[]> {
	const limit = Math.min(50, Math.max(1, params.limit ?? 10));
	const filters: string[] = ["deleted_at IS NULL"];
	const args: unknown[] = [];
	if (params.status) {
		filters.push("status = ?");
		args.push(params.status);
	}
	if (params.seasonId !== undefined) {
		filters.push("season_id = ?");
		args.push(params.seasonId);
	}
	const where = `WHERE ${filters.join(" AND ")}`;
	args.push(limit);
	// id DESC tie-break — 같은 unixepoch() 안에 여러 INSERT 가 들어왔을 때
	// 결정적 순서를 보장 (테스트 + UX 일관성).
	return query<SeriesRow>(
		`SELECT * FROM series ${where} ORDER BY started_at DESC, id DESC LIMIT ?`,
		args,
	);
}

/**
 * IN_PROGRESS 상태로 `cutoffUnixSec` 이전에 시작된 오래된 시리즈.
 */
export async function listStaleOpenSeries(cutoffUnixSec: number): Promise<SeriesRow[]> {
	return query<SeriesRow>(
		`SELECT * FROM series WHERE status = 'IN_PROGRESS' AND started_at < ? AND deleted_at IS NULL ORDER BY started_at`,
		[cutoffUnixSec],
	);
}

/**
 * Soft-delete 시리즈 — 운영 삭제 경로 (cleanup-stale / force-delete / season-reset) 의 공통 종착지.
 * recruitments.converted_series_id 는 별도 caller 가 NULL 처리.
 *
 * 종속 series_participants / games / game_stats / mmr_changes 행은 그대로 유지 — read 쿼리가
 * `series.deleted_at IS NULL` 필터로 가려준다. 같은 id 로 createSeries 호출 시,
 * 게임이 0개인 시리즈에 한해 revive 됨 (history 보존 invariant).
 */
export async function softDeleteSeries(seriesId: number): Promise<void> {
	await execute(`UPDATE series SET deleted_at = unixepoch() WHERE id = ? AND deleted_at IS NULL`, [
		seriesId,
	]);
}

/**
 * @deprecated softDeleteSeries 사용. 호출자 마이그레이션 후 제거.
 *
 * 기존 hard-delete 시그니처 유지 — 내부적으로 soft-delete 로 라우팅.
 * recruitments.converted_series_id 는 caller 가 별도 정리.
 */
export async function deleteSeriesPhysical(seriesId: number): Promise<void> {
	await execute(`UPDATE recruitments SET converted_series_id = NULL WHERE converted_series_id = ?`, [
		seriesId,
	]);
	await softDeleteSeries(seriesId);
}

/**
 * 진짜 물리 삭제 — admin 응급 / 데이터 정리 한정. 일반 흐름은 softDeleteSeries 사용.
 * CASCADE 로 series_participants/games/game_stats/mmr_changes 도 함께 삭제.
 */
export async function purgeSeries(seriesId: number): Promise<void> {
	await execute(`UPDATE recruitments SET converted_series_id = NULL WHERE converted_series_id = ?`, [
		seriesId,
	]);
	await execute(`DELETE FROM series WHERE id = ?`, [seriesId]);
}

/**
 * 시리즈 컨트롤 메시지 추적 — 한 시리즈 = 채널의 한 메시지.
 * 시리즈 생성 직후 또는 `/시리즈` 슬래시로 재게시 시 호출.
 */
export async function setSeriesMessage(
	seriesId: number,
	channelId: string,
	messageId: string,
): Promise<void> {
	await execute(`UPDATE series SET channel_id = ?, message_id = ? WHERE id = ?`, [
		channelId,
		messageId,
		seriesId,
	]);
}

/**
 * 시리즈 종료 카드 (Bo3 종료 시 모집 채널에 발행되는 결과 요약 메시지) 추적.
 * 봇이 메시지 발행 / edit 직후 호출. 이미 값이 있으면 edit 으로 멱등 처리.
 */
export async function setSeriesEndMessage(
	seriesId: number,
	channelId: string,
	messageId: string,
): Promise<void> {
	await execute(`UPDATE series SET end_card_channel_id = ?, end_card_message_id = ? WHERE id = ?`, [
		channelId,
		messageId,
		seriesId,
	]);
}

export async function listOpenSeriesByUser(userId: string): Promise<SeriesRow[]> {
	return query<SeriesRow>(
		`SELECT s.* FROM series s
		 JOIN series_participants sp ON sp.series_id = s.id
		 WHERE sp.user_id = ? AND s.status = 'IN_PROGRESS' AND s.deleted_at IS NULL
		 ORDER BY s.started_at DESC`,
		[userId],
	);
}

/**
 * 사용자가 참가했거나 운영한 최근 시리즈 (모든 status, soft-deleted 제외). /내전반복 자동완성용.
 */
export async function listRecentSeriesForUser(userId: string, limit = 25): Promise<SeriesRow[]> {
	return query<SeriesRow>(
		`SELECT DISTINCT s.* FROM series s
		 LEFT JOIN series_participants sp ON sp.series_id = s.id
		 WHERE (sp.user_id = ? OR s.created_by = ?) AND s.deleted_at IS NULL
		 ORDER BY s.started_at DESC
		 LIMIT ?`,
		[userId, userId, limit],
	);
}
