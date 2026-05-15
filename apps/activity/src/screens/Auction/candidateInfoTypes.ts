export interface AuctionCardData {
	user: { discordId: string; displayName: string };
	riotAccounts: Array<{
		gameName: string;
		tagLine: string;
		isMain: boolean;
		profileIconUrl: string | null;
		bestRanked: {
			queueType: string;
			tier: string;
			rank: string;
			leaguePoints: number;
			wins: number;
			losses: number;
		} | null;
		masteries: Array<{
			championId: number;
			name: string;
			iconUrl: string;
			points: number;
			level: number;
		}>;
	}>;
	laneMmrs: Array<{
		role: string;
		mmr: number | null;
		games: number;
		wins: number;
		losses: number;
	}>;
	topChampions: Array<{
		championId: number;
		championName: string;
		iconUrl: string;
		plays: number;
		wins: number;
		losses: number;
	}>;
}

export const LANE_LABEL: Record<string, string> = {
	TOP: "탑",
	JUNGLE: "정글",
	MID: "미드",
	BOTTOM: "원딜",
	SUPPORT: "서폿",
};

export const TIER_COLOR: Record<string, string> = {
	CHALLENGER: "text-warning",
	GRANDMASTER: "text-error",
	MASTER: "text-secondary",
	DIAMOND: "text-info",
	EMERALD: "text-success",
	PLATINUM: "text-accent",
	GOLD: "text-warning",
	SILVER: "text-base-content/70",
	BRONZE: "text-base-content/60",
	IRON: "text-base-content/50",
};

export function formatPoints(points: number): string {
	if (points >= 1_000_000) return `${(points / 1_000_000).toFixed(1)}M`;
	if (points >= 1_000) return `${(points / 1_000).toFixed(0)}k`;
	return String(points);
}

export function queueLabel(q: string): string {
	if (q === "RANKED_SOLO_5x5") return "솔로랭크";
	if (q === "RANKED_FLEX_SR") return "자유랭크";
	return q;
}
