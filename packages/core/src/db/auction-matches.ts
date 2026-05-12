// 경매 토너먼트 매치 — 기존 series 와 1:1 매핑.
// AUCTION 매치도 series row INSERT (type='AUCTION'), 추가 메타만 auction_matches 에.
// 게임 결과 / 픽 / 밴 / 통계 는 기존 games / game_picks / game_bans / game_stats 재사용.

import { execute, query, queryOne } from "../cloudflare/d1.js";
import { multiInsert } from "./sql.js";

export type AuctionMatchRound = "SEMI" | "FINAL" | "SINGLE";
export type AuctionMatchFormat = "BO1" | "BO3";

export interface AuctionMatchRow {
	series_id: number;
	tournament_id: number;
	round: AuctionMatchRound;
	bracket_index: number | null;
	team1_id: number;
	team2_id: number;
	format: AuctionMatchFormat;
}

/**
 * 매치 생성 — 기존 series row INSERT (type='AUCTION') + auction_matches 메타 + series_participants
 * placeholder INSERT (라인 5종 임의 분산 — Q8 프리 선택의 placeholder).
 *
 * caller 가 team1Members / team2Members (각 5명) 를 전달 — 팀원이 5명씩 갖춰진 상태에서만 호출.
 */
export async function createAuctionMatch(input: {
	seriesId: number; // 명시 부여 (모집/토너먼트 id 와 별개 — series 의 AUTOINCREMENT or 명시 id)
	seasonId: number;
	createdBy: string;
	tournamentId: number;
	round: AuctionMatchRound;
	bracketIndex: number | null;
	team1Id: number;
	team2Id: number;
	team1Members: ReadonlyArray<string>; // 5명
	team2Members: ReadonlyArray<string>; // 5명
	format: AuctionMatchFormat;
}): Promise<AuctionMatchRow> {
	if (input.team1Members.length !== 5 || input.team2Members.length !== 5) {
		throw new Error(
			`createAuctionMatch: 팀 멤버 수 ${input.team1Members.length}/${input.team2Members.length} — 5명/팀 필수`,
		);
	}

	// series row INSERT — type='AUCTION', auction_tournament_id FK
	await execute(
		`INSERT INTO series (id, season_id, status, created_by, type, auction_tournament_id)
		 VALUES (?, ?, 'IN_PROGRESS', ?, 'AUCTION', ?)`,
		[input.seriesId, input.seasonId, input.createdBy, input.tournamentId],
	);

	// series_participants placeholder INSERT (Q8 결정 — 라인 임의 분산)
	// 라인은 game_picks.role 에 게임 단위로 저장됨, series_participants.role 은 의미 X.
	// CHECK constraint + UNIQUE (series_id, team, role) 만족하기 위해 5종 라인 1명씩.
	const ROLE_ORDER = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;
	const spRows: unknown[][] = [];
	input.team1Members.forEach((uid, i) => {
		spRows.push([input.seriesId, uid, "TEAM_1", ROLE_ORDER[i]]);
	});
	input.team2Members.forEach((uid, i) => {
		spRows.push([input.seriesId, uid, "TEAM_2", ROLE_ORDER[i]]);
	});
	const spInsert = multiInsert(
		"series_participants",
		["series_id", "user_id", "team", "role"],
		spRows,
	);
	await execute(spInsert.sql, spInsert.params);

	// auction_matches 메타 INSERT
	const [row] = await query<AuctionMatchRow>(
		`INSERT INTO auction_matches (series_id, tournament_id, round, bracket_index, team1_id, team2_id, format)
		 VALUES (?, ?, ?, ?, ?, ?, ?)
		 RETURNING *`,
		[
			input.seriesId,
			input.tournamentId,
			input.round,
			input.bracketIndex,
			input.team1Id,
			input.team2Id,
			input.format,
		],
	);
	if (!row) throw new Error("createAuctionMatch: meta insert failed");
	return row;
}

export async function getAuctionMatch(seriesId: number): Promise<AuctionMatchRow | undefined> {
	return queryOne<AuctionMatchRow>(`SELECT * FROM auction_matches WHERE series_id = ?`, [seriesId]);
}

export async function listAuctionMatches(tournamentId: number): Promise<AuctionMatchRow[]> {
	return query<AuctionMatchRow>(
		`SELECT * FROM auction_matches WHERE tournament_id = ?
		 ORDER BY CASE round WHEN 'SINGLE' THEN 0 WHEN 'SEMI' THEN 1 WHEN 'FINAL' THEN 2 END, bracket_index`,
		[tournamentId],
	);
}

export async function setAuctionMatchFormat(
	seriesId: number,
	format: AuctionMatchFormat,
): Promise<void> {
	await execute(`UPDATE auction_matches SET format = ? WHERE series_id = ?`, [format, seriesId]);
}
