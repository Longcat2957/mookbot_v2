// W2 — 픽밴 자동 advance 의 다음 슬롯 계산.
//   "자유" 모드: allSlots 순서 (T1 BAN 0~4 → T2 BAN 0~4 → T1 PICK 0~4 → T2 PICK 0~4) 의 다음 빈 슬롯.
//   "LoL 표준" 모드: 정식 토너먼트 픽밴 순서 (5v5 가정). 5v5 외엔 자유 모드 fallback.

import {
	type ActiveSlot,
	allSlots,
	type GameDraft,
	type Side,
	sameSlot,
	type Team,
} from "./types.js";

export type OrderMode = "free" | "lol";

function nextFreeSlot(
	current: ActiveSlot,
	teamSize: number,
	gameDraft: GameDraft,
): ActiveSlot | null {
	const all = allSlots(teamSize);
	const i = all.findIndex((s) => sameSlot(s, current));
	if (i < 0) return null;
	for (let off = 1; off < all.length; off++) {
		const ni = (i + off) % all.length;
		const next = all[ni];
		if (!next) continue;
		const arr = next.kind === "ban" ? gameDraft.bans[next.team] : gameDraft.picks[next.team];
		if (arr[next.idx] == null) return next;
	}
	return null;
}

// 5v5 LoL 표준 픽밴 순서 (sides 기준 — team1Side 따라 TEAM_1/TEAM_2 매핑).
const LOL_STANDARD: { side: Side; kind: "ban" | "pick"; idx: number }[] = [
	// Phase 1 BAN (3밴씩)
	{ side: "BLUE", kind: "ban", idx: 0 },
	{ side: "RED", kind: "ban", idx: 0 },
	{ side: "BLUE", kind: "ban", idx: 1 },
	{ side: "RED", kind: "ban", idx: 1 },
	{ side: "BLUE", kind: "ban", idx: 2 },
	{ side: "RED", kind: "ban", idx: 2 },
	// Phase 1 PICK
	{ side: "BLUE", kind: "pick", idx: 0 },
	{ side: "RED", kind: "pick", idx: 0 },
	{ side: "RED", kind: "pick", idx: 1 },
	{ side: "BLUE", kind: "pick", idx: 1 },
	{ side: "BLUE", kind: "pick", idx: 2 },
	{ side: "RED", kind: "pick", idx: 2 },
	// Phase 2 BAN (2밴씩, RED 가 먼저)
	{ side: "RED", kind: "ban", idx: 3 },
	{ side: "BLUE", kind: "ban", idx: 3 },
	{ side: "RED", kind: "ban", idx: 4 },
	{ side: "BLUE", kind: "ban", idx: 4 },
	// Phase 2 PICK
	{ side: "RED", kind: "pick", idx: 3 },
	{ side: "BLUE", kind: "pick", idx: 3 },
	{ side: "BLUE", kind: "pick", idx: 4 },
	{ side: "RED", kind: "pick", idx: 4 },
];

function mapLolStandard(team1Side: Side): ActiveSlot[] {
	const sideToTeam: Record<Side, Team> =
		team1Side === "BLUE" ? { BLUE: "TEAM_1", RED: "TEAM_2" } : { BLUE: "TEAM_2", RED: "TEAM_1" };
	return LOL_STANDARD.map((o) => ({ kind: o.kind, team: sideToTeam[o.side], idx: o.idx }));
}

function nextLolSlot(
	current: ActiveSlot,
	team1Side: Side,
	teamSize: number,
	gameDraft: GameDraft,
): ActiveSlot | null {
	if (teamSize !== 5) return nextFreeSlot(current, teamSize, gameDraft);
	const ordered = mapLolStandard(team1Side);
	const i = ordered.findIndex((s) => sameSlot(s, current));
	if (i < 0) return nextFreeSlot(current, teamSize, gameDraft);
	for (let off = 1; off < ordered.length; off++) {
		const ni = (i + off) % ordered.length;
		const next = ordered[ni];
		if (!next) continue;
		const arr = next.kind === "ban" ? gameDraft.bans[next.team] : gameDraft.picks[next.team];
		if (arr[next.idx] == null) return next;
	}
	return null;
}

export function nextSlotForAdvance(
	mode: OrderMode,
	current: ActiveSlot,
	team1Side: Side | null,
	teamSize: number,
	gameDraft: GameDraft,
): ActiveSlot | null {
	if (mode === "lol" && team1Side) return nextLolSlot(current, team1Side, teamSize, gameDraft);
	return nextFreeSlot(current, teamSize, gameDraft);
}
