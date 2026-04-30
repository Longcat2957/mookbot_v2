import { execute, query } from "../cloudflare/d1.js";
import { multiInsert } from "./sql.js";
import type { Role, Team } from "../mmr/elo.js";

// ============================================================
// 게임별 픽/밴 — 결과기록 후 [픽밴 입력] 모달이 작성.
// games 행이 먼저 존재해야 하며, ON DELETE CASCADE 로 게임 삭제 시 자동 정리.
// ============================================================

export interface GamePick {
	team: Team;
	role: Role;
	championName: string;
}

export interface GameBan {
	team: Team;
	position: number; // 1~5
	championName: string;
}

export interface GamePickRow {
	game_id: number;
	team: Team;
	role: Role;
	champion_name: string;
}

export interface GameBanRow {
	game_id: number;
	team: Team;
	position: number;
	champion_name: string;
}

/** 한 게임의 픽 전체를 set — 기존 행은 모두 삭제 후 재삽입 (atomic 한 multi-row insert). */
export async function setGamePicks(gameId: number, picks: GamePick[]): Promise<void> {
	await execute(`DELETE FROM game_picks WHERE game_id = ?`, [gameId]);
	if (picks.length === 0) return;
	const stmt = multiInsert(
		"game_picks",
		["game_id", "team", "role", "champion_name"],
		picks.map((p) => [gameId, p.team, p.role, p.championName] as const),
	);
	await execute(stmt.sql, stmt.params);
}

/** 한 게임의 밴 전체를 set — 기존 행 삭제 후 재삽입. */
export async function setGameBans(gameId: number, bans: GameBan[]): Promise<void> {
	await execute(`DELETE FROM game_bans WHERE game_id = ?`, [gameId]);
	if (bans.length === 0) return;
	const stmt = multiInsert(
		"game_bans",
		["game_id", "team", "position", "champion_name"],
		bans.map((b) => [gameId, b.team, b.position, b.championName] as const),
	);
	await execute(stmt.sql, stmt.params);
}

export async function getGamePicks(gameId: number): Promise<GamePickRow[]> {
	return query<GamePickRow>(
		`SELECT game_id, team, role, champion_name
		   FROM game_picks WHERE game_id = ?
		   ORDER BY team, role`,
		[gameId],
	);
}

export async function getGameBans(gameId: number): Promise<GameBanRow[]> {
	return query<GameBanRow>(
		`SELECT game_id, team, position, champion_name
		   FROM game_bans WHERE game_id = ?
		   ORDER BY team, position`,
		[gameId],
	);
}

/**
 * 시리즈 hard fearless 룰: 시리즈 내 어느 게임이든 한 번 픽된 챔프는
 * 양 팀 모두 그 시리즈의 다른 게임에서 다시 못 픽함. 밴은 무관.
 *
 * 시리즈 내 이미 픽된 챔프 set 반환. excludeGameId 가 있으면 그 게임 픽은 제외
 * (이미 기록된 게임을 다시 set 할 때 자기 자신과 충돌 안 나게).
 */
export async function getSeriesUsedChampions(
	seriesId: number,
	excludeGameId?: number,
): Promise<Set<string>> {
	const params: unknown[] = [seriesId];
	let extra = "";
	if (excludeGameId !== undefined) {
		extra = " AND gp.game_id != ?";
		params.push(excludeGameId);
	}
	const rows = await query<{ champion_name: string }>(
		`SELECT DISTINCT gp.champion_name
		   FROM game_picks gp
		   JOIN games g ON g.id = gp.game_id
		  WHERE g.series_id = ?${extra}`,
		params,
	);
	return new Set(rows.map((r) => r.champion_name));
}

export interface FearlessViolation {
	team: Team;
	role: Role;
	championName: string;
	reason: "previous_game" | "duplicate_in_input";
}

/**
 * hard fearless 규칙 검증 — 입력된 picks 가:
 *   1) 이전 게임에서 사용한 챔프와 겹치는지 (previous_game)
 *   2) 입력 자체에 같은 챔프 중복인지 (duplicate_in_input)
 * 위반 행만 반환. 빈 배열이면 통과.
 */
export async function validateFearless(
	seriesId: number,
	picks: ReadonlyArray<GamePick>,
	excludeGameId?: number,
): Promise<FearlessViolation[]> {
	const used = await getSeriesUsedChampions(seriesId, excludeGameId);
	const violations: FearlessViolation[] = [];
	const seenInInput = new Set<string>();
	for (const p of picks) {
		if (used.has(p.championName)) {
			violations.push({
				team: p.team,
				role: p.role,
				championName: p.championName,
				reason: "previous_game",
			});
		} else if (seenInInput.has(p.championName)) {
			violations.push({
				team: p.team,
				role: p.role,
				championName: p.championName,
				reason: "duplicate_in_input",
			});
		}
		seenInInput.add(p.championName);
	}
	return violations;
}

/** 한 시리즈의 모든 게임 픽/밴 — Bo3 통합 뷰용. */
export interface SeriesPicksAndBans {
	picks: GamePickRow[]; // 모든 게임 합산, game_id 로 그룹핑 가능
	bans: GameBanRow[];
}

export async function getSeriesPicksAndBans(seriesId: number): Promise<SeriesPicksAndBans> {
	const [picks, bans] = await Promise.all([
		query<GamePickRow>(
			`SELECT gp.game_id, gp.team, gp.role, gp.champion_name
			   FROM game_picks gp
			   JOIN games g ON g.id = gp.game_id
			  WHERE g.series_id = ?
			  ORDER BY g.game_number, gp.team, gp.role`,
			[seriesId],
		),
		query<GameBanRow>(
			`SELECT gb.game_id, gb.team, gb.position, gb.champion_name
			   FROM game_bans gb
			   JOIN games g ON g.id = gb.game_id
			  WHERE g.series_id = ?
			  ORDER BY g.game_number, gb.team, gb.position`,
			[seriesId],
		),
	]);
	return { picks, bans };
}
