// ============================================================
// Record game + apply MMR (orchestrator)
// ============================================================
//
// 한 게임 기록은 다음을 모두 포함해야 한다:
//   1. games 1행 INSERT
//   2. game_stats 10행 INSERT
//   3. mmr_changes 10행 INSERT (라인 매치업 ELO)
//   4. user_lane_mmr 10건 UPSERT (현재 값 + 누적 카운터)
//
// D1는 batch 단위로 트랜잭션 보장하지만, AUTOINCREMENT id를 캡쳐하려면
// 먼저 games를 INSERT...RETURNING으로 한 번 호출해 id를 얻어야 한다.
// 즉 2-phase: (1) games INSERT, (2) 나머지 batch.
// (2)가 실패하면 best-effort로 games 행을 DELETE하여 orphan을 제거한다.
// ============================================================

import { batch, execute, query } from "../cloudflare/d1.js";
import {
	applyGameElo,
	DEFAULT_MMR,
	ROLES,
	type LaneMatchup,
	type Role,
	type Team,
} from "../mmr/elo.js";
import { getCurrentSeason } from "./seasons.js";
import { getSeriesParticipants } from "./series.js";
import { getLaneMmrs } from "./mmr.js";
import type { GameRow, Side } from "./games.js";
import { multiInsert } from "./sql.js";

export interface PlayerStats {
	userId: string;
	championId?: number;
	kills?: number;
	deaths?: number;
	assists?: number;
	cs?: number;
}

export interface RecordGameInput {
	seriesId: number;
	gameNumber: 1 | 2 | 3;
	winningTeam: Team;
	team1Side: Side;
	durationSec?: number;
	riotMatchId?: string;
	stats?: ReadonlyArray<PlayerStats>;
}

export interface MmrChangeSummary {
	userId: string;
	role: Role;
	opponentId: string;
	mmrBefore: number;
	mmrAfter: number;
	delta: number;
}

export interface RecordGameResult {
	game: GameRow;
	mmrChanges: MmrChangeSummary[];
}

export async function recordGameAndUpdateMmr(
	input: RecordGameInput,
): Promise<RecordGameResult> {
	const participants = await getSeriesParticipants(input.seriesId);
	if (participants.length === 0) {
		throw new Error(`recordGame: series ${input.seriesId} 참가자 없음`);
	}

	const season = await getCurrentSeason();
	if (!season) throw new Error("recordGame: no active season");

	// 라인 매핑 (N v N 지원 — 5v5 미만에서는 active roles 만)
	const team1ByRole = new Map<Role, string>();
	const team2ByRole = new Map<Role, string>();
	for (const p of participants) {
		(p.team === "TEAM_1" ? team1ByRole : team2ByRole).set(p.role, p.user_id);
	}
	const activeRoles: Role[] = ROLES.filter(
		(r) => team1ByRole.has(r) && team2ByRole.has(r),
	);
	if (activeRoles.length === 0) {
		throw new Error(
			`recordGame: series ${input.seriesId} 라인 매치업 없음 (t1=${[...team1ByRole.keys()].join(",")}, t2=${[...team2ByRole.keys()].join(",")})`,
		);
	}

	// 현재 MMR 로드 — 활성 (user_id, role) 페어만
	const mmrPairs = participants.map((p) => ({ userId: p.user_id, role: p.role }));
	const mmrRows = await getLaneMmrs(mmrPairs, season.id);
	const mmrByKey = new Map<string, number>();
	for (const r of mmrRows) {
		mmrByKey.set(`${r.user_id}|${r.role}`, r.mmr);
	}
	const mmrFor = (userId: string, role: Role): number =>
		mmrByKey.get(`${userId}|${role}`) ?? DEFAULT_MMR;

	const matchups: LaneMatchup[] = activeRoles.map((role) => {
		const team1User = team1ByRole.get(role)!;
		const team2User = team2ByRole.get(role)!;
		return {
			role,
			team1: { userId: team1User, mmr: mmrFor(team1User, role) },
			team2: { userId: team2User, mmr: mmrFor(team2User, role) },
		};
	});

	const eloResults = applyGameElo(matchups, input.winningTeam);

	// Phase 1: INSERT game, capture id
	const [game] = await query<GameRow>(
		`INSERT INTO games (series_id, game_number, winning_team, team1_side, duration_sec, riot_match_id)
		 VALUES (?, ?, ?, ?, ?, ?)
		 RETURNING *`,
		[
			input.seriesId,
			input.gameNumber,
			input.winningTeam,
			input.team1Side,
			input.durationSec ?? null,
			input.riotMatchId ?? null,
		],
	);
	if (!game) throw new Error("recordGame: failed to insert game");

	// Phase 2: batch all dependent writes
	try {
		await batch(buildPostGameStatements(game.id, season.id, input, participants, eloResults));
	} catch (err) {
		await execute(`DELETE FROM games WHERE id = ?`, [game.id]).catch(() => undefined);
		throw err;
	}

	// Build summary for return value
	const summary: MmrChangeSummary[] = [];
	for (const r of eloResults) {
		summary.push({
			userId: r.team1.userId,
			role: r.role,
			opponentId: r.team1.opponentId,
			mmrBefore: r.team1.mmrBefore,
			mmrAfter: r.team1.mmrAfter,
			delta: r.team1.delta,
		});
		summary.push({
			userId: r.team2.userId,
			role: r.role,
			opponentId: r.team2.opponentId,
			mmrBefore: r.team2.mmrBefore,
			mmrAfter: r.team2.mmrAfter,
			delta: r.team2.delta,
		});
	}

	return { game, mmrChanges: summary };
}

// ------------------------------------------------------------
// Post-game batch builder
// ------------------------------------------------------------

function buildPostGameStatements(
	gameId: number,
	seasonId: number,
	input: RecordGameInput,
	participants: ReadonlyArray<{ user_id: string; team: Team; role: Role }>,
	eloResults: ReturnType<typeof applyGameElo>,
) {
	const statsByUser = new Map(input.stats?.map((s) => [s.userId, s]) ?? []);

	const gameStatsRows = participants.map((p) => {
		const s = statsByUser.get(p.user_id);
		return [
			gameId,
			p.user_id,
			p.team,
			p.role,
			s?.championId ?? null,
			s?.kills ?? 0,
			s?.deaths ?? 0,
			s?.assists ?? 0,
			s?.cs ?? 0,
			p.team === input.winningTeam ? 1 : 0,
		];
	});

	const mmrRows: unknown[][] = [];
	const laneUpsertRows: unknown[][] = [];
	for (const r of eloResults) {
		for (const side of [r.team1, r.team2] as const) {
			mmrRows.push([
				gameId,
				side.userId,
				seasonId,
				r.role,
				side.opponentId,
				side.mmrBefore,
				side.mmrAfter,
				side.delta,
			]);
			const won = side.delta > 0 ? 1 : 0;
			laneUpsertRows.push([side.userId, seasonId, r.role, side.mmrAfter, won]);
		}
	}

	return [
		multiInsert(
			"game_stats",
			["game_id", "user_id", "team", "role", "champion_id", "kills", "deaths", "assists", "cs", "won"],
			gameStatsRows,
		),
		multiInsert(
			"mmr_changes",
			["game_id", "user_id", "season_id", "role", "opponent_id", "mmr_before", "mmr_after", "delta"],
			mmrRows,
		),
		buildLaneMmrUpsert(laneUpsertRows),
	];
}

function buildLaneMmrUpsert(rows: ReadonlyArray<readonly unknown[]>) {
	const placeholder = `(?, ?, ?, ?, 1, ?, unixepoch())`;
	const sql = `INSERT INTO user_lane_mmr (user_id, season_id, role, mmr, games_played, wins, updated_at)
	             VALUES ${rows.map(() => placeholder).join(", ")}
	             ON CONFLICT(user_id, season_id, role) DO UPDATE SET
	               mmr          = excluded.mmr,
	               games_played = user_lane_mmr.games_played + 1,
	               wins         = user_lane_mmr.wins + excluded.wins,
	               updated_at   = unixepoch()`;
	return { sql, params: rows.flatMap((r) => [...r]) };
}

// ============================================================
// Undo last game
// ============================================================
//
// 시리즈의 가장 마지막 게임을 통째로 되돌린다. 사용 시나리오: 운영자가
// 잘못 클릭해서 1팀/2팀을 헷갈렸을 때 "직전 게임 되돌리기".
//
// 절차:
//   1) games 의 max(game_number) 게임 + 그 mmr_changes 모두 읽기
//   2) user_lane_mmr 누적값 차감 (delta, games_played, wins)
//   3) games 행 DELETE → CASCADE 로 game_stats / mmr_changes / game_picks / game_bans 자동 삭제
//   4) 시리즈가 이 게임으로 COMPLETED 됐었다면 IN_PROGRESS 복구
//
// 비-atomic: D1 HTTP API 가 batch 트랜잭션 미지원이라 실패 시 부분 적용 가능.
// 실패 시 운영자 forceDeleteSeries 로 정리하도록 안내.
// ============================================================

export interface UndoLastGameResult {
	undoneGameId: number;
	undoneGameNumber: 1 | 2 | 3;
	rollbackRows: number;
	restoredToInProgress: boolean;
}

export async function undoLastGame(seriesId: number): Promise<UndoLastGameResult> {
	const series = await import("./series.js").then((m) => m.getSeries(seriesId));
	if (!series) throw new Error(`undoLastGame: series ${seriesId} 없음`);
	if (series.status === "CANCELLED") {
		throw new Error("undoLastGame: 취소된 시리즈는 되돌릴 수 없음");
	}

	const [latest] = await query<GameRow>(
		`SELECT * FROM games WHERE series_id = ? ORDER BY game_number DESC LIMIT 1`,
		[seriesId],
	);
	if (!latest) throw new Error("undoLastGame: 되돌릴 게임이 없음");

	// 라인별 MMR 변동 합산 — 한 게임 내 mmr_changes 는 (user_id, role) 별 1행이지만
	// SUM/COUNT 를 거쳐서 user_lane_mmr UPDATE 형태로 변환.
	const aggregated = await query<{
		user_id: string;
		season_id: number;
		role: Role;
		total_delta: number;
		games_played: number;
		wins: number;
	}>(
		`SELECT
		    user_id,
		    season_id,
		    role,
		    SUM(delta) AS total_delta,
		    COUNT(*) AS games_played,
		    SUM(CASE WHEN delta > 0 THEN 1 ELSE 0 END) AS wins
		 FROM mmr_changes WHERE game_id = ?
		 GROUP BY user_id, season_id, role`,
		[latest.id],
	);

	let rollbackRows = 0;
	if (aggregated.length > 0) {
		const stmts = aggregated.map((a) => ({
			sql: `UPDATE user_lane_mmr SET
			        mmr = mmr - ?,
			        games_played = MAX(0, games_played - ?),
			        wins = MAX(0, wins - ?),
			        updated_at = unixepoch()
			      WHERE user_id = ? AND season_id = ? AND role = ?`,
			params: [a.total_delta, a.games_played, a.wins, a.user_id, a.season_id, a.role] as unknown[],
		}));
		await batch(stmts);
		rollbackRows = stmts.length;
	}

	// CASCADE: game_stats, mmr_changes, game_picks, game_bans 모두 자동 삭제
	await execute(`DELETE FROM games WHERE id = ?`, [latest.id]);

	// 이 게임으로 시리즈가 COMPLETED 됐었다면 IN_PROGRESS 복구
	let restoredToInProgress = false;
	if (series.status === "COMPLETED") {
		await execute(
			`UPDATE series SET status = 'IN_PROGRESS', winning_team = NULL, ended_at = NULL WHERE id = ?`,
			[seriesId],
		);
		restoredToInProgress = true;
	}

	return {
		undoneGameId: latest.id,
		undoneGameNumber: latest.game_number,
		rollbackRows,
		restoredToInProgress,
	};
}
