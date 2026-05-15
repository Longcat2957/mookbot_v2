export const ROLE_ORDER = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;
export type Role = (typeof ROLE_ORDER)[number];
export type GameTeam = "TEAM_1" | "TEAM_2";

export interface Champion {
	id: number;
	idSlug: string;
	name: string;
	iconUrl: string;
}

export type RoleAssignment = Record<GameTeam, Partial<Record<Role, string>>>;
export type RolePicks = Record<GameTeam, Partial<Record<Role, number>>>;
export type TeamBans = Record<GameTeam, number[]>;

export type ChampPickerTarget =
	| { kind: "pick"; team: GameTeam; role: Role }
	| { kind: "ban"; team: GameTeam; index: number };

export function createEmptyAssignment(): RoleAssignment {
	return { TEAM_1: {}, TEAM_2: {} };
}

export function createEmptyPicks(): RolePicks {
	return { TEAM_1: {}, TEAM_2: {} };
}

export function createEmptyBans(): TeamBans {
	return { TEAM_1: [], TEAM_2: [] };
}

export function usedChampionIds(picks: RolePicks, bans: TeamBans): Set<number> {
	const set = new Set<number>();
	for (const team of ["TEAM_1", "TEAM_2"] as const) {
		for (const role of ROLE_ORDER) {
			const c = picks[team][role];
			if (c != null) set.add(c);
		}
		for (const b of bans[team]) if (b != null) set.add(b);
	}
	return set;
}

export function validateGameInput(assign: RoleAssignment, picks: RolePicks): string | null {
	for (const team of ["TEAM_1", "TEAM_2"] as const) {
		for (const role of ROLE_ORDER) {
			if (!assign[team][role]) return `${team} ${role} 사용자 미지정`;
			if (!picks[team][role]) return `${team} ${role} 챔프 미지정`;
		}
		const userIds = Object.values(assign[team]);
		if (new Set(userIds).size !== userIds.length) return `${team} 안에 같은 사용자 중복`;
	}
	return null;
}

export function buildTeamPicks(assign: RoleAssignment, picks: RolePicks, team: GameTeam) {
	return ROLE_ORDER.map((role) => {
		const userId = assign[team][role];
		const championId = picks[team][role];
		if (!userId || !championId) {
			throw new Error(`${team} ${role} 입력 누락`);
		}
		return { userId, role, championId };
	});
}
