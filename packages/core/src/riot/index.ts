// ============================================================
// Riot API Service — Unified Export
// ============================================================

export { getAccountByPuuid, getAccountByRiotId, parseRiotId } from "./account.js";
export { getChampionMasteries, getTopMasteries } from "./championMastery.js";
export type { Platform, Region } from "./client.js";
export {
	__clearRiotCacheForTest,
	formatTier,
	RiotApiClient,
	riotClient,
	tierValue,
} from "./client.js";
export { formatLeagueEntries, getLeagueEntries, getLeagueEntry } from "./league.js";
export { findParticipant, formatKDA, getMatch, getMatchIds, getRecentMatches } from "./match.js";
export { getCurrentGameByPuuid } from "./spectator.js";
export { getSummonerByPuuid } from "./summoner.js";

export type * from "./types.js";

// --- Convenience: Full player profile ---

import { getAccountByRiotId } from "./account.js";
import { getTopMasteries } from "./championMastery.js";
import { getLeagueEntries } from "./league.js";
import { getSummonerByPuuid } from "./summoner.js";
import type { PlayerProfile } from "./types.js";

/**
 * Fetch a full player profile by Riot ID (GameName#TagLine).
 * Aggregates account, summoner, league, and top champion masteries.
 */
export async function getPlayerProfile(riotId: string): Promise<PlayerProfile> {
	const account = await getAccountByRiotId(riotId);
	const summoner = await getSummonerByPuuid(account.puuid);
	const leagueEntries = await getLeagueEntries(account.puuid);
	const topMasteries = await getTopMasteries(account.puuid, 5);

	return { account, summoner, leagueEntries, topMasteries };
}
