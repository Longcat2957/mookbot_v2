export interface MatchDetail {
	match: {
		id: number;
		status: string;
		winningTeam: "TEAM_1" | "TEAM_2" | null;
		format: "BO1" | "BO3";
	};
	games: {
		id: number;
		gameNumber: number;
		team1Side: "BLUE" | "RED";
		winningTeam: "TEAM_1" | "TEAM_2";
		durationSec: number | null;
		picks: { team: "TEAM_1" | "TEAM_2"; role: string; championName: string }[];
		bans?: { team: "TEAM_1" | "TEAM_2"; position: number; championName: string }[];
	}[];
}
