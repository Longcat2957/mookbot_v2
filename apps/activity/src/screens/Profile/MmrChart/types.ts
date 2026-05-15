export const ROLES = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
	TOP: "탑",
	JUNGLE: "정글",
	MID: "미드",
	BOTTOM: "원딜",
	SUPPORT: "서폿",
};

export const ROLE_COLOR: Record<Role, string> = {
	TOP: "#3b82f6",
	JUNGLE: "#22c55e",
	MID: "#a855f7",
	BOTTOM: "#f59e0b",
	SUPPORT: "#ec4899",
};

export interface HistoryPoint {
	createdAt: number;
	gameId: number;
	role: Role;
	mmrBefore: number;
	mmrAfter: number;
	delta: number;
}

export interface HistoryResponse {
	userId: string;
	role: string | null;
	seasonId: number | null;
	points: HistoryPoint[];
}

export interface ChartRow {
	createdAt: number;
	timeLabel: string;
	TOP?: number;
	JUNGLE?: number;
	MID?: number;
	BOTTOM?: number;
	SUPPORT?: number;
}
