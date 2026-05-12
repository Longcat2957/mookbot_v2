// 경매 팀 + 팀원 — 토너먼트 안의 2팀 (10인) 또는 4팀 (20인).
// 팀장은 자기 팀에 INSERT 됨 (auction_team_members 에 acquired_via='MANUAL' 로).

import { execute, query, queryOne } from "../cloudflare/d1.js";

export interface AuctionTeamRow {
	id: number;
	tournament_id: number;
	team_index: number;
	captain_user_id: string;
	team_name: string | null;
	initial_points: number;
	current_points: number;
}

export interface AuctionTeamMemberRow {
	team_id: number;
	user_id: string;
	acquired_via: "BID" | "MANUAL";
	acquired_at_points: number | null;
}

export async function createAuctionTeam(input: {
	tournamentId: number;
	teamIndex: number;
	captainUserId: string;
	initialPoints?: number;
	teamName?: string;
}): Promise<AuctionTeamRow> {
	const initial = input.initialPoints ?? 1000;
	const [row] = await query<AuctionTeamRow>(
		`INSERT INTO auction_teams (tournament_id, team_index, captain_user_id, team_name, initial_points, current_points)
		 VALUES (?, ?, ?, ?, ?, ?)
		 RETURNING *`,
		[
			input.tournamentId,
			input.teamIndex,
			input.captainUserId,
			input.teamName ?? null,
			initial,
			initial,
		],
	);
	if (!row) throw new Error("createAuctionTeam: insert failed");
	// 팀장은 자기 팀의 첫 멤버 — 경매 대상 X (acquired_via=MANUAL, points=NULL)
	await addAuctionTeamMember({
		teamId: row.id,
		userId: input.captainUserId,
		acquiredVia: "MANUAL",
	});
	return row;
}

export async function getAuctionTeam(id: number): Promise<AuctionTeamRow | undefined> {
	return queryOne<AuctionTeamRow>(`SELECT * FROM auction_teams WHERE id = ?`, [id]);
}

export async function listAuctionTeams(tournamentId: number): Promise<AuctionTeamRow[]> {
	return query<AuctionTeamRow>(
		`SELECT * FROM auction_teams WHERE tournament_id = ? ORDER BY team_index`,
		[tournamentId],
	);
}

export async function setAuctionTeamPoints(
	teamId: number,
	initialPoints: number,
	currentPoints?: number,
): Promise<void> {
	await execute(`UPDATE auction_teams SET initial_points = ?, current_points = ? WHERE id = ?`, [
		initialPoints,
		currentPoints ?? initialPoints,
		teamId,
	]);
}

export async function adjustAuctionTeamCurrentPoints(teamId: number, delta: number): Promise<void> {
	await execute(`UPDATE auction_teams SET current_points = current_points + ? WHERE id = ?`, [
		delta,
		teamId,
	]);
}

export async function setAuctionTeamName(teamId: number, teamName: string): Promise<void> {
	await execute(`UPDATE auction_teams SET team_name = ? WHERE id = ?`, [teamName, teamId]);
}

// ============================================================
// members
// ============================================================

export async function addAuctionTeamMember(input: {
	teamId: number;
	userId: string;
	acquiredVia: "BID" | "MANUAL";
	acquiredAtPoints?: number;
}): Promise<void> {
	await execute(
		`INSERT INTO auction_team_members (team_id, user_id, acquired_via, acquired_at_points)
		 VALUES (?, ?, ?, ?)
		 ON CONFLICT(team_id, user_id) DO NOTHING`,
		[input.teamId, input.userId, input.acquiredVia, input.acquiredAtPoints ?? null],
	);
}

export async function removeAuctionTeamMember(teamId: number, userId: string): Promise<void> {
	await execute(`DELETE FROM auction_team_members WHERE team_id = ? AND user_id = ?`, [
		teamId,
		userId,
	]);
}

export async function listAuctionTeamMembers(teamId: number): Promise<AuctionTeamMemberRow[]> {
	return query<AuctionTeamMemberRow>(`SELECT * FROM auction_team_members WHERE team_id = ?`, [
		teamId,
	]);
}

/**
 * 토너먼트 전체 팀원 — userId → teamId 매핑용.
 */
export async function listAuctionTeamMembersByTournament(
	tournamentId: number,
): Promise<Array<AuctionTeamMemberRow & { tournament_id: number; team_index: number }>> {
	return query<AuctionTeamMemberRow & { tournament_id: number; team_index: number }>(
		`SELECT atm.*, at.tournament_id, at.team_index
		 FROM auction_team_members atm
		 JOIN auction_teams at ON at.id = atm.team_id
		 WHERE at.tournament_id = ?
		 ORDER BY at.team_index`,
		[tournamentId],
	);
}

export async function getAuctionTeamForUserInTournament(
	tournamentId: number,
	userId: string,
): Promise<AuctionTeamRow | undefined> {
	return queryOne<AuctionTeamRow>(
		`SELECT at.* FROM auction_teams at
		 JOIN auction_team_members atm ON atm.team_id = at.id
		 WHERE at.tournament_id = ? AND atm.user_id = ?`,
		[tournamentId, userId],
	);
}
