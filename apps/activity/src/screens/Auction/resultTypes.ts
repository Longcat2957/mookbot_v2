export interface MatchSeriesDetail {
	id: number;
	winningTeam: "TEAM_1" | "TEAM_2" | null;
	games: {
		id: number;
		gameNumber: number;
		winningTeam: "TEAM_1" | "TEAM_2";
		team1Side?: "BLUE" | "RED";
		picks: { team: "TEAM_1" | "TEAM_2"; role: string; championName: string }[];
		bans?: { team: "TEAM_1" | "TEAM_2"; position: number; championName: string }[];
	}[];
}

export interface AuctionMatchDetailResponse {
	match: {
		id: number;
		status: string;
		winningTeam: "TEAM_1" | "TEAM_2" | null;
	};
	games: MatchSeriesDetail["games"];
}

export const ROLE_ORDER = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;
