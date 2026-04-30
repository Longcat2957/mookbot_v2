import { riotClient } from "./client.js";
import type { SummonerDto } from "./types.js";

/**
 * Get summoner info by puuid.
 */
export async function getSummonerByPuuid(puuid: string): Promise<SummonerDto> {
	return riotClient.getSummonerByPuuid(puuid);
}