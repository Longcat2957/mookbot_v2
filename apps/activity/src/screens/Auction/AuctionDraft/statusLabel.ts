import type { TournamentStatus } from "../types.js";

export function statusLabel(s: TournamentStatus): string {
	return {
		CAPTAIN_PICK: "팀장 선출",
		POINT_ALLOC: "포인트 배정",
		BIDDING: "경매 진행",
		PLACEMENT: "배치 완료",
		BRACKET_SETUP: "토너먼트 설정",
		IN_GAME: "매치 진행",
		COMPLETED: "종료",
		CANCELLED: "취소",
	}[s];
}
