// EntryEditing 화면 공유 types + 상수 + 작은 헬퍼.

export const LANES = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;
export type Lane = (typeof LANES)[number];
export type Team = "TEAM_1" | "TEAM_2";

export const LANE_LABEL: Record<Lane, string> = {
	TOP: "탑",
	JUNGLE: "정글",
	MID: "미드",
	BOTTOM: "원딜",
	SUPPORT: "서폿",
};

export const ROLE_LABEL: Record<string, string> = {
	TOP: "탑",
	JUNGLE: "정글",
	MID: "미드",
	BOTTOM: "원딜",
	SUPPORT: "서폿",
	FLEX: "FLEX",
};

export const TEAM_LABEL: Record<Team, string> = {
	TEAM_1: "1팀",
	TEAM_2: "2팀",
};

export interface WL {
	plays: number;
	wins: number;
	losses: number;
}

export interface ChampionPlay extends WL {
	championId: number;
	championName: string;
	iconUrl: string;
}

export interface RolePlay extends WL {
	role: string;
}

export interface PlayHistory {
	total: WL;
	topChampions: ChampionPlay[];
	rolePlays: RolePlay[];
	topRole: RolePlay | null;
}

export interface Participant {
	userId: string;
	displayName: string;
	roles: string[];
	joinedAt: number;
	history: PlayHistory;
	profileIconUrl?: string | null;
	mainPosition?: string | null;
	soloRanked?: {
		tier: string;
		rank: string;
		leaguePoints: number;
		wins: number;
		losses: number;
	} | null;
}

export interface HeadToHead {
	userId: string;
	opponentId: string;
	role: Lane;
	plays: number;
	wins: number;
	losses: number;
}

export interface EntryDraft {
	// userId → "TEAM_1_TOP" / "TEAM_2_MID" 등 Slot
	assignments: Record<string, string>;
}

export interface RecruitmentDetail {
	recruitment: {
		id: number;
		targetCount: number;
		status: string;
		createdBy: string;
		createdAt: number;
	};
	participants: Participant[];
	headToHead?: HeadToHead[];
	entryDraft: EntryDraft | null;
}

export type Slot = `${Team}_${Lane}`;
export type Assignment = Map<string, Slot>;

// 호환 alias — 신규 코드는 `state/winrateColor.ts` 의 `winrateBadgeClass` 직접 사용.
export { winrateBadgeClass as wrColor } from "../../state/winrateColor.js";
