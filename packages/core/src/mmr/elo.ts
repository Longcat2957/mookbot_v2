// ============================================================
// ELO MMR — lane matchup based
// ============================================================
//
// 라인 고정 Bo3에서 각 플레이어의 MMR은
//   "같은 라인 상대"와 1대1로 비교하여 갱신한다.
//
// 표준 ELO 공식:
//   expected = 1 / (1 + 10^((opponent - me) / 400))
//   new_mmr  = me + K * (actual - expected)
// ============================================================

export const DEFAULT_MMR = 1500;
export const K_FACTOR = 32;

export type Role = "TOP" | "JUNGLE" | "MID" | "BOTTOM" | "SUPPORT";

/**
 * Team = 내전 시리즈의 로스터 라벨. 시리즈 내내 고정.
 * 주의: 리그 오브 레전드의 게임 내 사이드(BLUE/RED)와는 다른 개념.
 * (사이드 스왑 추적은 추후 별도 컬럼으로 추가 예정 — roadmap.md 참고)
 */
export type Team = "TEAM_1" | "TEAM_2";

export const ROLES: readonly Role[] = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;

/**
 * Probability that `myMmr` beats `oppMmr` (0..1).
 */
export function expectedScore(myMmr: number, oppMmr: number): number {
	return 1 / (1 + Math.pow(10, (oppMmr - myMmr) / 400));
}

export interface EloUpdate {
	mmrBefore: number;
	mmrAfter: number;
	delta: number;
}

/**
 * Compute new MMR for one player vs their lane opponent.
 */
export function updateElo(
	myMmr: number,
	oppMmr: number,
	won: boolean,
	k: number = K_FACTOR,
): EloUpdate {
	const expected = expectedScore(myMmr, oppMmr);
	const actual = won ? 1 : 0;
	const delta = k * (actual - expected);
	return {
		mmrBefore: myMmr,
		mmrAfter: myMmr + delta,
		delta,
	};
}

// ------------------------------------------------------------
// Game-level batch update
// ------------------------------------------------------------

export interface LaneMatchup {
	role: Role;
	team1: { userId: string; mmr: number };
	team2: { userId: string; mmr: number };
}

export interface LaneMatchupResult {
	role: Role;
	team1: { userId: string; opponentId: string } & EloUpdate;
	team2: { userId: string; opponentId: string } & EloUpdate;
}

/**
 * Apply ELO to all 5 lane matchups for a single game.
 * `winner` is the team(roster) that won.
 */
export function applyGameElo(
	matchups: LaneMatchup[],
	winner: Team,
	k: number = K_FACTOR,
): LaneMatchupResult[] {
	return matchups.map((m) => {
		const team1Won = winner === "TEAM_1";
		const team1Update = updateElo(m.team1.mmr, m.team2.mmr, team1Won, k);
		const team2Update = updateElo(m.team2.mmr, m.team1.mmr, !team1Won, k);
		return {
			role: m.role,
			team1: { userId: m.team1.userId, opponentId: m.team2.userId, ...team1Update },
			team2: { userId: m.team2.userId, opponentId: m.team1.userId, ...team2Update },
		};
	});
}
