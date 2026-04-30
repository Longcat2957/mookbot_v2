import { riotClient } from "./client.js";
import type { MatchDto, MatchParticipantDto } from "./types.js";

/**
 * Get recent match IDs for a player.
 */
export async function getMatchIds(puuid: string, count: number = 20): Promise<string[]> {
	return riotClient.getMatchIds(puuid, count);
}

/**
 * Get full match details by match ID.
 */
export async function getMatch(matchId: string): Promise<MatchDto> {
	return riotClient.getMatch(matchId);
}

/**
 * Get recent matches with full details.
 * Fetches match IDs first, then retrieves each match.
 */
export async function getRecentMatches(puuid: string, count: number = 5): Promise<MatchDto[]> {
	const matchIds = await getMatchIds(puuid, count);
	const matches: MatchDto[] = [];
	for (const id of matchIds) {
		const match = await getMatch(id);
		matches.push(match);
	}
	return matches;
}

/**
 * Find a participant in a match by puuid.
 */
export function findParticipant(match: MatchDto, puuid: string): MatchParticipantDto | undefined {
	return match.info.participants.find((p) => p.puuid === puuid);
}

/**
 * Format a participant's KDA.
 */
export function formatKDA(kills: number, deaths: number, assists: number): string {
	const kda = deaths === 0 ? "Perfect" : ((kills + assists) / deaths).toFixed(2);
	return `${kills}/${deaths}/${assists} (${kda})`;
}