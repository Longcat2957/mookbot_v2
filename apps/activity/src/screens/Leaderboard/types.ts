export type LeaderboardTab = "TOP" | "JUNGLE" | "MID" | "BOTTOM" | "SUPPORT" | "COMPOSITE";

export const LEADERBOARD_TABS: { key: LeaderboardTab; label: string }[] = [
	{ key: "TOP", label: "탑" },
	{ key: "JUNGLE", label: "정글" },
	{ key: "MID", label: "미드" },
	{ key: "BOTTOM", label: "원딜" },
	{ key: "SUPPORT", label: "서폿" },
	{ key: "COMPOSITE", label: "통합" },
];

export interface LeaderRow {
	rank: number;
	userId: string;
	displayName: string;
	profileIconUrl: string | null;
	mmr: number;
	games: number;
	wins: number;
	losses: number;
	winrate: number;
	rolesPlayed?: number;
	topChampion: {
		championId: number;
		championName: string;
		iconUrl: string;
		splashUrl: string;
	} | null;
}

export interface LeaderboardResponse {
	role: string;
	seasonId: number;
	rows: LeaderRow[];
}
