import { getRiotClient } from "./client.js";
import type { AccountDto } from "./types.js";

/**
 * Parse "GameName#TagLine" into separate components.
 * Returns [gameName, tagLine] or throws if format is invalid.
 */
export function parseRiotId(riotId: string): [gameName: string, tagLine: string] {
	const sep = riotId.indexOf("#");
	if (sep === -1 || sep === 0 || sep === riotId.length - 1) {
		throw new Error(`Invalid Riot ID format: "${riotId}". Expected "GameName#TagLine".`);
	}
	return [riotId.slice(0, sep), riotId.slice(sep + 1)];
}

/**
 * Look up a Riot account by "GameName#TagLine".
 */
export async function getAccountByRiotId(riotId: string): Promise<AccountDto> {
	const [gameName, tagLine] = parseRiotId(riotId);
	return getRiotClient().getAccountByRiotId(gameName, tagLine);
}

/**
 * Look up a Riot account by PUUID — Riot ID rename 추적용.
 */
export async function getAccountByPuuid(puuid: string): Promise<AccountDto> {
	return getRiotClient().getAccountByPuuid(puuid);
}
