import { riotClient } from "./client.js";
import type { ChampionMasteryDto } from "./types.js";

/**
 * Get all champion masteries for a player (sorted by points descending).
 */
export async function getChampionMasteries(puuid: string): Promise<ChampionMasteryDto[]> {
	return riotClient.getChampionMasteries(puuid);
}

/**
 * Get top N champion masteries for a player.
 */
export async function getTopMasteries(puuid: string, count: number = 5): Promise<ChampionMasteryDto[]> {
	const masteries = await getChampionMasteries(puuid);
	return masteries.slice(0, count);
}