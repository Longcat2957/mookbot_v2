import type { LineupParticipant } from "../../components/LineupPreview.js";

export type Team = "TEAM_1" | "TEAM_2";
export type Side = "BLUE" | "RED";

export interface Champion {
	id: number;
	idSlug: string;
	name: string;
	iconUrl: string;
}

export interface GameDetail {
	id: number;
	gameNumber: number;
	team1Side: Side;
	winningTeam: Team;
	durationSec: number | null;
	picks: { team: Team; role: string; championName: string; championId: number | null }[];
	bans: { team: Team; position: number; championName: string; championId: number | null }[];
}

export interface SeriesDetail {
	series: {
		id: number;
		status: string;
		startedAt: number;
		winningTeam: Team | null;
	};
	participants: LineupParticipant[];
	games: GameDetail[];
}

export const LANE_LABEL: Record<string, string> = {
	TOP: "탑",
	JUNGLE: "정글",
	MID: "미드",
	BOTTOM: "원딜",
	SUPPORT: "서폿",
};

export const LANE_ORDER = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;

export function teamLabel(team: Team) {
	return team === "TEAM_1" ? "1팀" : "2팀";
}
