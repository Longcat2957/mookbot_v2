export const ROLE_LABEL: Record<string, string> = {
	TOP: "탑",
	JUNGLE: "정글",
	MID: "미드",
	BOTTOM: "원딜",
	SUPPORT: "서폿",
	FLEX: "FLEX",
};

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
	wins: number;
	losses: number;
	winrate: number;
}

export interface RecentGame {
	gameId: number;
	seriesId: number;
	gameNumber: number;
	playedAt: number;
	team: "TEAM_1" | "TEAM_2";
	role: string;
	side: "BLUE" | "RED";
	championId: number | null;
	championName: string | null;
	iconUrl: string | null;
	won: boolean;
	mmrDelta: number | null;
	mmrAfter: number | null;
}

export interface ProfileResponse {
	user: { discordId: string; displayName: string; profileIconUrl: string | null };
	riotAccounts: RiotAccount[];
	season: { id: number; name: string };
	laneMmrs: LaneMmr[];
	totals: { games: number; wins: number; losses: number; winrate: number };
	topChampions: TopChampion[];
	recentGames: RecentGame[];
}

export function winrateToneClass(winratePct: number) {
	if (winratePct >= 60) return "text-success";
	if (winratePct >= 50) return "text-info";
	if (winratePct >= 40) return "text-base-content/70";
	return "text-error";
}
