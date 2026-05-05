// 백필 스크립트 — profile_icon_id 가 NULL 인 riot_accounts 에 대해 Summoner-V4 호출.
// v0.3.20 schema 변경 직후 1회 실행. 그 후엔 신규 등록 흐름이 자동 저장.
//
// 사용:
//   pnpm --filter @mookbot/core backfill:profile-icons
//
// rate limit 보호: 호출 간 250ms (Riot dev 키 20 req/s 의 절반).
//   ENV RIOT_API_KEY 필수.

import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { execute, query } from "../cloudflare/d1.js";
import { getSummonerByPuuid } from "../riot/summoner.js";

config({ path: fileURLToPath(new URL("../../../../.env", import.meta.url)) });

const RATE_DELAY_MS = 250;

async function main(): Promise<void> {
	const rows = await query<{ puuid: string; user_id: string }>(
		`SELECT puuid, user_id FROM riot_accounts WHERE profile_icon_id IS NULL ORDER BY updated_at`,
	);
	console.log(`[backfill] ${rows.length} riot accounts without profile_icon_id`);

	let success = 0;
	let fail = 0;
	for (const row of rows) {
		try {
			const s = await getSummonerByPuuid(row.puuid);
			await execute(
				`UPDATE riot_accounts SET profile_icon_id = ?, updated_at = unixepoch() WHERE puuid = ?`,
				[s.profileIconId, row.puuid],
			);
			console.log(`  ✓ ${row.user_id} ${row.puuid.slice(0, 8)}… → icon ${s.profileIconId}`);
			success++;
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			console.warn(`  ✗ ${row.user_id} ${row.puuid.slice(0, 8)}… : ${msg}`);
			fail++;
		}
		await new Promise((r) => setTimeout(r, RATE_DELAY_MS));
	}
	console.log(`[backfill] done — success=${success} fail=${fail}`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
