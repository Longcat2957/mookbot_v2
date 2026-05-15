export type Side = "BLUE" | "RED";
export type Team = "TEAM_1" | "TEAM_2";

export interface ChampionPlay {
	championId: number;
	championName: string;
	iconUrl: string;
	plays: number;
	wins: number;
	losses: number;
}

export interface PlayHistory {
	total: { plays: number; wins: number; losses: number };
	topChampions: ChampionPlay[];
	topChampionsByRole: Record<string, ChampionPlay[]>;
	rolePlays: { role: string; plays: number; wins: number; losses: number }[];
	topRole: { role: string; plays: number; wins: number; losses: number } | null;
}

export interface BalanceParticipant {
	userId: string;
	displayName: string;
	team: Team;
	role: string;
	laneMmr: number;
	history: PlayHistory;
}

export const LANE_ORDER = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;
export const LANE_LABEL: Record<string, string> = {
	TOP: "탑",
	JUNGLE: "정글",
	MID: "미드",
	BOTTOM: "원딜",
	SUPPORT: "서폿",
};
