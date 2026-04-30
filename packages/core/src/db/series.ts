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
}

export interface SeriesParticipantRow {
	series_id: number;
	user_id: string;
	team: Team;
	role: Role;
}

export interface CreateSeriesInput {
	seasonId: number;
	createdBy: string;
	participants: ReadonlyArray<{ userId: string; team: Team; role: Role }>;
}

/**
 * Bo3 시리즈 생성. 1v1 ~ 5v5 까지 N v N 지원 (참가자 = 짝수, 2~10).
 * 양 팀 라인 수 일치 + 같은 라인이 양 팀에 존재해야 라인 매치업 ELO 가능.
 *
 * 비-atomic: series + series_participants 가 분리 트랜잭션. participant insert 실패 시
 * series row 가 IN_PROGRESS 0인 으로 남음 — cleanup 잡이 정리.
 */
export async function createSeries(input: CreateSeriesInput): Promise<SeriesRow> {
	const n = input.participants.length;
	if (n < 2 || n > 10 || n % 2 !== 0) {
		throw new Error(
			`createSeries: 참가자 수 ${n} — 2~10 짝수 (1v1 ~ 5v5) 만 지원`,
		);
	}
	const t1 = input.participants.filter((p) => p.team === "TEAM_1");
	const t2 = input.participants.filter((p) => p.team === "TEAM_2");
	if (t1.length !== t2.length) {
		throw new Error(
			`createSeries: 팀 크기 불일치 (TEAM_1=${t1.length}, TEAM_2=${t2.length})`,
		);
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

	const [series] = await query<SeriesRow>(
		`INSERT INTO series (season_id, created_by) VALUES (?, ?) RETURNING *`,
		[input.seasonId, input.createdBy],
	);
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
	return queryOne<SeriesRow>(`SELECT * FROM series WHERE id = ?`, [id]);
}

export async function getSeriesParticipants(
	seriesId: number,
): Promise<SeriesParticipantRow[]> {
	return query<SeriesParticipantRow>(
		`SELECT * FROM series_participants WHERE series_id = ?`,
		[seriesId],
	);
}

export async function completeSeries(id: number, winningTeam: Team): Promise<void> {
	await execute(
		`UPDATE series SET status = 'COMPLETED', winning_team = ?, ended_at = unixepoch()
		 WHERE id = ? AND status = 'IN_PROGRESS'`,
		[winningTeam, id],
	);
}

export async function cancelSeries(id: number): Promise<void> {
	await execute(
		`UPDATE series SET status = 'CANCELLED', ended_at = unixepoch()
		 WHERE id = ? AND status = 'IN_PROGRESS'`,
		[id],
	);
}

export async function listAllOpenSeries(): Promise<SeriesRow[]> {
	return query<SeriesRow>(
		`SELECT * FROM series WHERE status = 'IN_PROGRESS' ORDER BY started_at DESC`,
	);
}

/**
 * IN_PROGRESS 상태로 `cutoffUnixSec` 이전에 시작된 오래된 시리즈.
 */
export async function listStaleOpenSeries(cutoffUnixSec: number): Promise<SeriesRow[]> {
	return query<SeriesRow>(
		`SELECT * FROM series WHERE status = 'IN_PROGRESS' AND started_at < ? ORDER BY started_at`,
		[cutoffUnixSec],
	);
}

/**
 * 시리즈 행과 종속 데이터 전체 물리 삭제. CASCADE 로 series_participants/games/game_stats/mmr_changes 도 함께 삭제.
 * recruitments.converted_series_id 는 ON DELETE 정책이 없어서 먼저 SET NULL 처리.
 * 단, user_lane_mmr 의 누적값은 자동으로 되돌리지 않음 — 별도 rollback 필요.
 */
export async function deleteSeriesPhysical(seriesId: number): Promise<void> {
	await execute(
		`UPDATE recruitments SET converted_series_id = NULL WHERE converted_series_id = ?`,
		[seriesId],
	);
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
	await execute(
		`UPDATE series SET channel_id = ?, message_id = ? WHERE id = ?`,
		[channelId, messageId, seriesId],
	);
}

export async function listOpenSeriesByUser(userId: string): Promise<SeriesRow[]> {
	return query<SeriesRow>(
		`SELECT s.* FROM series s
		 JOIN series_participants sp ON sp.series_id = s.id
		 WHERE sp.user_id = ? AND s.status = 'IN_PROGRESS'
		 ORDER BY s.started_at DESC`,
		[userId],
	);
}

/**
 * 사용자가 참가했거나 운영한 최근 시리즈 (모든 status). /내전반복 자동완성용.
 */
export async function listRecentSeriesForUser(
	userId: string,
	limit = 25,
): Promise<SeriesRow[]> {
	return query<SeriesRow>(
		`SELECT DISTINCT s.* FROM series s
		 LEFT JOIN series_participants sp ON sp.series_id = s.id
		 WHERE sp.user_id = ? OR s.created_by = ?
		 ORDER BY s.started_at DESC
		 LIMIT ?`,
		[userId, userId, limit],
	);
}
