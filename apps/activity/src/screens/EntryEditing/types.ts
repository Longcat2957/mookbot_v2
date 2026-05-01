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
	entryDraft: EntryDraft | null;
}

export type Slot = `${Team}_${Lane}`;
export type Assignment = Map<string, Slot>;

export function wrColor(wr: number): string {
	if (wr >= 60) return "badge-success";
	if (wr >= 50) return "badge-info";
	if (wr >= 40) return "badge-warning";
	return "badge-error";
}
