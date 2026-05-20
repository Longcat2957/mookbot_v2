import { formatTier, getRiotClient } from "./client.js";
import type { LeagueEntryDto, QueueType } from "./types.js";

/**
 * Get all league entries for a player by puuid.
 */
export async function getLeagueEntries(puuid: string): Promise<LeagueEntryDto[]> {
	return getRiotClient().getLeagueEntries(puuid);
}

/**
 * Get a specific queue type league entry by puuid.
 * Returns undefined if the player has no ranked data for that queue.
 */
export async function getLeagueEntry(
	puuid: string,
	queueType: QueueType,
): Promise<LeagueEntryDto | undefined> {
	const entries = await getLeagueEntries(puuid);
	return entries.find((e) => e.queueType === queueType);
}

/**
 * Format league entries into a readable string.
 */
export function formatLeagueEntries(entries: LeagueEntryDto[]): string {
	if (entries.length === 0) return "Unranked";
	return entries
		.map((e) => {
			const queue = e.queueType === "RANKED_SOLO_5x5" ? "솔로랭크" : "자유랭크";
			const winrate = ((e.wins / (e.wins + e.losses)) * 100).toFixed(1);
			return `${queue}: ${formatTier(e.tier, e.rank, e.leaguePoints)} (${e.wins}W ${e.losses}L ${winrate}%)`;
		})
		.join("\n");
}
