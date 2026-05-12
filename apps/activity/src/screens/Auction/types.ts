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

export interface AuctionTeamMember {
	userId: string;
	displayName: string;
	acquiredVia: "BID" | "MANUAL";
	acquiredAtPoints: number | null;
}

export interface AuctionTeam {
	id: number;
	teamIndex: number;
	captainUserId: string;
	captainName: string;
	teamName: string | null;
	initialPoints: number;
	currentPoints: number;
	members: AuctionTeamMember[];
}

export interface AuctionMatch {
	seriesId: number;
	round: MatchRound;
	bracketIndex: number | null;
	team1Id: number;
	team2Id: number;
	format: MatchFormat;
}

export interface AuctionBid {
	id: number;
	targetUserId: string;
	teamId: number;
	points: number;
	isFinal: boolean;
	createdAt: number;
}

export interface AuctionTournamentDetail {
	tournament: {
		id: number;
		format: 10 | 20;
		status: TournamentStatus;
		championTeamId: number | null;
		startedAt: number;
		endedAt: number | null;
	};
	teams: AuctionTeam[];
	unsold: Array<{ userId: string; displayName: string }>;
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
		joinedAt: number;
	}>;
}
