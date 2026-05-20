import { getRiotClient } from "./client.js";
import type { CurrentGameInfoDto } from "./types.js";

/**
 * 현재 진행 중인 게임 정보 조회. 게임 중이 아니면 404 → 호출 측에서 catch.
 */
export async function getCurrentGameByPuuid(puuid: string): Promise<CurrentGameInfoDto> {
	return getRiotClient().getCurrentGame(puuid);
}
