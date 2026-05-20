import { datadragon } from "@mookbot/core";

export type Team = "TEAM_1" | "TEAM_2";
export type Role = "TOP" | "JUNGLE" | "MID" | "BOTTOM" | "SUPPORT";

export const TEAMS = ["TEAM_1", "TEAM_2"] as const;
const ROLES = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;

export function validateDraftGameInput(input: {
	team1Members: Set<string>;
	team2Members: Set<string>;
	picks: {
		TEAM_1: { userId: string; role: Role; championId: number }[];
		TEAM_2: { userId: string; role: Role; championId: number }[];
	};
	bans: { TEAM_1: number[]; TEAM_2: number[] };
	team1Side: "BLUE" | "RED";
	winningTeam: Team;
}): string | null {
	if (input.team1Side !== "BLUE" && input.team1Side !== "RED") return "team1Side invalid";
	if (input.winningTeam !== "TEAM_1" && input.winningTeam !== "TEAM_2") return "winningTeam invalid";

	const seenUsers = new Set<string>();
	const seenChampions = new Set<number>();
	for (const team of TEAMS) {
		const picks = input.picks?.[team];
		if (!Array.isArray(picks) || picks.length !== ROLES.length) {
			return `${team} picks must contain exactly 5 roles`;
		}
		const roleSet = new Set<Role>();
		const allowedUsers = team === "TEAM_1" ? input.team1Members : input.team2Members;
		for (const pick of picks) {
			if (!ROLES.includes(pick.role)) return `${team} role invalid`;
			if (roleSet.has(pick.role)) return `${team} role duplicated`;
			roleSet.add(pick.role);
			if (!allowedUsers.has(pick.userId)) return `${team} user is not a match member`;
			if (seenUsers.has(pick.userId)) return "user duplicated across picks";
			seenUsers.add(pick.userId);
			if (!Number.isInteger(pick.championId) || !datadragon.getChampionData(pick.championId)) {
				return `${team} champion invalid`;
			}
			if (seenChampions.has(pick.championId)) return "champion duplicated";
			seenChampions.add(pick.championId);
		}
		for (const role of ROLES) {
			if (!roleSet.has(role)) return `${team} role missing`;
		}

		const bans = input.bans?.[team];
		if (!Array.isArray(bans) || bans.length > 5) return `${team} bans invalid`;
		for (const championId of bans) {
			if (!Number.isInteger(championId) || !datadragon.getChampionData(championId)) {
				return `${team} ban champion invalid`;
			}
			if (seenChampions.has(championId)) return "champion duplicated";
			seenChampions.add(championId);
		}
	}
	return null;
}
