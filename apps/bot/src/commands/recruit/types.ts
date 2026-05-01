// recruit 명령 공유 types + 상수.

import { db } from "@mookbot/core";

export const { ROLE_SLOTS } = db;

export type RoleSlot = (typeof ROLE_SLOTS)[number];

export const ROLE_LABEL: Record<RoleSlot, string> = {
	TOP: "탑",
	JUNGLE: "정글",
	MID: "미드",
	BOTTOM: "원딜",
	SUPPORT: "서폿",
};
