import type { LineupParticipant } from "../../components/LineupPreview.js";

export interface Recruitment {
	id: number;
	targetCount: number;
	status: string;
	createdBy: string;
	createdAt: number;
}

export interface SeriesItem {
	id: number;
	seasonId: number;
	status: string;
	startedAt: number;
	participants: LineupParticipant[];
}

export interface CompletedSeries {
	id: number;
	seasonId: number;
	winningTeam: "TEAM_1" | "TEAM_2" | null;
	startedAt: number;
	endedAt: number | null;
	wins: { team1: number; team2: number };
	participants: LineupParticipant[];
}

export interface AuctionRecListItem {
	id: number;
	targetCount: number;
	status: string;
	createdBy: string;
	createdAt: number;
}

export type PendingItem =
	| { kind: "rec"; data: Recruitment; sortKey: number }
	| { kind: "series"; data: SeriesItem; sortKey: number };
