import type { Lane, Team } from "../types.js";

export function allSlotsFilled(values: (number | null)[]): boolean {
	return values.every((value) => value !== null);
}

export function buildPickPayload(lanes: Lane[], picks: (number | null)[]) {
	return lanes.map((lane, index) => ({
		role: lane,
		championId: picks[index] ?? -1,
	}));
}

export function compactChampionIds(values: (number | null)[]): number[] {
	return values.filter((value): value is number => value !== null);
}

export function resultSubmitTip({
	canEdit,
	allBansFilled,
	allPicksFilled,
	team1SideSelected,
	winner,
}: {
	canEdit: boolean;
	allBansFilled: boolean;
	allPicksFilled: boolean;
	team1SideSelected: boolean;
	winner: Team | null;
}): string | undefined {
	if (!canEdit) return "이 Activity 방을 연 사람만 조작할 수 있습니다.";
	if (!allBansFilled) return "밴 슬롯을 모두 채워야 합니다.";
	if (!allPicksFilled) return "픽 슬롯을 모두 채워야 합니다.";
	if (!team1SideSelected) return "사이드(BLUE/RED)를 먼저 선택하세요.";
	if (winner === null) return "승리 팀을 선택하세요.";
	return undefined;
}
