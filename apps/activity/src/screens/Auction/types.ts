// 경매내전 Activity 화면 공유 types.
// api 응답 (/api/auction-tournaments/:id) 구조와 매칭.

export type TournamentStatus =
	| "CAPTAIN_PICK"
	| "POINT_ALLOC"
	| "BIDDING"
	| "PLACEMENT"
	| "BRACKET_SETUP"
	| "IN_GAME"
	| "COMPLETED"
	| "CANCELLED";

export type MatchRound = "SEMI" | "FINAL" | "SINGLE";
export type MatchFormat = "BO1" | "BO3";

/** 라운드 라벨 — UI 의 단일 출처. bracketIndex 가 있으면 "4강 #1" 처럼 인덱스도 표기. */
export function roundLabel(round: MatchRound, bracketIndex?: number | null): string {
	if (round === "FINAL") return "결승";
	if (round === "SINGLE") return "매치";
	// SEMI
	return bracketIndex != null ? `4강 #${bracketIndex}` : "4강";
}

export interface AuctionTeamMember {
	userId: string;
	displayName: string;
	profileIconUrl: string | null;
	acquiredVia: "BID" | "MANUAL";
	acquiredAtPoints: number | null;
}

export interface AuctionTeam {
	id: number;
	teamIndex: number;
	captainUserId: string;
	captainName: string;
	captainProfileIconUrl: string | null;
	teamName: string | null;
	initialPoints: number;
	currentPoints: number;
	members: AuctionTeamMember[];
}

export interface AuctionMatch {
	matchId: number;
	round: MatchRound;
	bracketIndex: number | null;
	team1Id: number;
	team2Id: number;
	format: MatchFormat;
	status: "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
	winningTeam: "TEAM_1" | "TEAM_2" | null;
}

export interface AuctionBid {
	id: number;
	targetUserId: string;
	teamId: number;
	points: number;
	isFinal: boolean;
	createdAt: number;
}

export interface CurrentBidIntent {
	teamId: number;
	points: number;
}

export interface CurrentBidTarget {
	userId: string;
	displayName: string;
	profileIconUrl: string | null;
	/** 운영자들이 입력 중인 입찰 의도 (실시간 공유). transient — finalize/cancel/status 전환 시 자동 clear. */
	intents: CurrentBidIntent[];
}

export interface AuctionTournamentDetail {
	tournament: {
		id: number;
		format: 10 | 20;
		status: TournamentStatus;
		championTeamId: number | null;
		startedAt: number;
		endedAt: number | null;
		/** v0.14: BIDDING 진행 중 현재 매물 — null 이면 매물 없음 (draw 대기). */
		currentBidTarget: CurrentBidTarget | null;
	};
	teams: AuctionTeam[];
	unsold: Array<{ userId: string; displayName: string; profileIconUrl: string | null }>;
	matches: AuctionMatch[];
	bids: AuctionBid[];
}

export interface AuctionRecruitmentListItem {
	id: number;
	targetCount: 10 | 20;
	status: "OPEN" | "CLOSED" | "CONVERTED" | "CANCELLED";
	createdBy: string;
	createdAt: number;
}

export interface AuctionRecruitmentDetail {
	recruitment: {
		id: number;
		targetCount: 10 | 20;
		status: string;
		convertedTournamentId: number | null;
		createdBy: string;
		createdAt: number;
	};
	participants: Array<{
		userId: string;
		displayName: string;
		profileIconUrl: string | null;
		joinedAt: number;
	}>;
}
