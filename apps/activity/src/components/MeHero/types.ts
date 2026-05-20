export const ROLE_LABEL: Record<string, string> = {
	TOP: "탑",
	JUNGLE: "정글",
	MID: "미드",
	BOTTOM: "원딜",
	SUPPORT: "서폿",
	FLEX: "FLEX",
};

export const ROLE_ORDER = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;

export interface RiotAccount {
	gameName: string;
	tagLine: string;
	isMain: boolean;
	profileIconUrl: string | null;
	mainPosition: string | null;
	mainPositionUpdatedAt: number | null;
}

export interface LaneMmr {
	role: string;
	mmr: number | null;
	games: number;
	wins: number;
	losses: number;
	winrate: number;
}

export interface TopChampion {
	championId: number;
	championName: string;
	iconUrl: string;
	splashUrl: string;
	plays: number;
}

export interface MeProfileResponse {
	user: { discordId: string; displayName: string; profileIconUrl: string | null };
	riotAccounts: RiotAccount[];
	season: { id: number; name: string };
	laneMmrs: LaneMmr[];
	totals: { games: number; wins: number; losses: number; winrate: number };
	topChampions: TopChampion[];
}
