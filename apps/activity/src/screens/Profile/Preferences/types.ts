export const ROLES = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
	TOP: "탑",
	JUNGLE: "정글",
	MID: "미드",
	BOTTOM: "원딜",
	SUPPORT: "서폿",
};

export interface PreferenceChamp {
	championId: number;
	championName: string;
	iconUrl: string;
}

export interface PreferencesResponse {
	user: { discordId: string; displayName: string };
	maxPerRole: number;
	preferences: Record<Role, PreferenceChamp[]>;
}
