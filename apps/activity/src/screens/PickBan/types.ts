// PickBan 화면 공유 types + 상수 + 작은 헬퍼.
// (큰 헬퍼/컴포넌트는 동일 디렉토리의 별도 파일로 분리)

import type { LineupParticipant } from "../../components/LineupPreview.js";

export type Team = "TEAM_1" | "TEAM_2";
export type Side = "BLUE" | "RED";

export interface Champion {
	id: number;
	idSlug: string;
	name: string;
	iconUrl: string;
}

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

export interface SeriesParticipant extends LineupParticipant {
	userId: string;
	laneMmr: number;
	history: PlayHistory;
}

export interface SeriesDetail {
	series: {
		id: number;
		status: string;
		startedAt: number;
		winningTeam: Team | null;
	};
	participants: SeriesParticipant[];
	games: {
		id: number;
		gameNumber: number;
		team1Side: Side;
		winningTeam: Team;
		durationSec: number | null;
		picks: { team: Team; role: string; championName: string; championId: number | null }[];
	}[];
	pickbanDraft: PickBanDraft | null;
}

export interface GameDraft {
	gameNumber: number;
	team1Side: Side | null;
	bans: { TEAM_1: (number | null)[]; TEAM_2: (number | null)[] };
	picks: { TEAM_1: (number | null)[]; TEAM_2: (number | null)[] };
}

export interface PickBanDraft {
	games: GameDraft[];
	currentGame: number;
}

export const LANE_LABEL: Record<string, string> = {
	TOP: "탑",
	JUNGLE: "정글",
	MID: "미드",
	BOTTOM: "원딜",
	SUPPORT: "서폿",
};

export const LANE_ORDER = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;

export function emptyGameDraft(n: number, banCount: number, pickCount: number): GameDraft {
	return {
		gameNumber: n,
		team1Side: null,
		bans: {
			TEAM_1: Array(banCount).fill(null),
			TEAM_2: Array(banCount).fill(null),
		},
		picks: {
			TEAM_1: Array(pickCount).fill(null),
			TEAM_2: Array(pickCount).fill(null),
		},
	};
}

export function sideTextColor(side: Side): string {
	return side === "BLUE" ? "text-info font-bold" : "text-error font-bold";
}
