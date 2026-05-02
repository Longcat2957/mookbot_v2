// ============================================================
// UX 테스트용 시드 — 운영 흐름이 채워진 D1 상태를 한 번에 만들어
// /내전모집 · /팀짜기 · /진행중 · /랭킹 등 임베드를 곧바로 검토 가능.
//
// 사용:
//   pnpm run db:seed -- --confirm   (로컬 D1, 빈 DB 권장)
//
// 운영 D1 에서 돌리려면 db:reset 으로 비운 뒤 운영 컨테이너에서:
//   ssh root@... 'docker exec mookbot node dist/services/db/seed.js --confirm'
// ============================================================

import { config } from "dotenv";
import type { Role } from "../mmr/elo.js";
import {
	addRecruitmentParticipant,
	completeSeries,
	createRecruitment,
	createSeason,
	createSeries,
	getCurrentSeason,
	linkRiotAccount,
	recordGameAndUpdateMmr,
	setRecruitmentRoles,
	setRecruitmentStatus,
	upsertUser,
} from "./index.js";

config();

const args = new Set(process.argv.slice(2));
if (!args.has("--confirm")) {
	console.error("[seed] --confirm 플래그 필요. 가짜 데이터를 D1 에 대량 추가합니다.");
	console.error("        빈 DB 권장 — db:reset 후 db:seed.");
	process.exit(1);
}

const ROLES: readonly Role[] = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"];

const NAMES = [
	"정현(Longcat)",
	"길동(Hong)",
	"철수(SteelHead)",
	"영희(Bright)",
	"민준(Brave)",
	"서윤(Soyo)",
	"지호(Jiho)",
	"예린(Yerin)",
	"하준(Hajun)",
	"수아(Sua)",
	"지우(Jiwoo)",
	"도윤(Doyun)",
	"하은(Haeun)",
	"시우(Siwoo)",
	"주원(Juwon)",
	"예준(Yejun)",
	"이안(Ian)",
	"유진(Yujin)",
	"다은(Daeun)",
	"서아(Seoa)",
];

function fakePuuid(idx: number): string {
	const base = `test_puuid_${String(idx).padStart(3, "0")}_`;
	return (base + "x".repeat(78 - base.length)).slice(0, 78);
}

function gameNameFromDisplay(display: string, fallback: string): string {
	const m = display.match(/\(([^)#]+)/);
	return m?.[1]?.trim() ?? fallback;
}

console.log("[seed] start");

// 1. 시즌
let season = await getCurrentSeason();
if (!season) {
	season = await createSeason("테스트 시즌");
}
console.log(`  season: ${season.name} (id=${season.id})`);

// 2. 사용자 + 첫 15명 라이엇 연결
const userIds: string[] = [];
for (const [i, name] of NAMES.entries()) {
	const id = `test_${String(i + 1).padStart(3, "0")}`;
	await upsertUser(id, name);
	userIds.push(id);
	if (i < 15) {
		await linkRiotAccount({
			userId: id,
			puuid: fakePuuid(i + 1),
			gameName: gameNameFromDisplay(name, `Player${i + 1}`),
			tagLine: "KR1",
			setMain: true,
		});
	}
}
console.log(`  users: ${userIds.length} (riot accounts: 15)`);

// 3. OPEN 모집 — 7명 참가, 라인 선호 일부만 채움
const openRec = await createRecruitment({
	seasonId: season.id,
	targetCount: 10,
	createdBy: userIds[0]!,
});
for (let i = 0; i < 7; i++) {
	await addRecruitmentParticipant({ recruitmentId: openRec.id, userId: userIds[i]! });
	if (i < 5) {
		const roles: Role[] = [ROLES[i % 5]!];
		if (i % 2 === 0) roles.push(ROLES[(i + 2) % 5]!);
		await setRecruitmentRoles(openRec.id, userIds[i]!, roles);
	}
	// 5, 6 번째는 라인 무관
}
console.log(`  open recruitment: #${openRec.id} (7/10명)`);

// 4. CLOSED 모집 — 10명 가득, /팀짜기 바로 가능
const closedRec = await createRecruitment({
	seasonId: season.id,
	targetCount: 10,
	createdBy: userIds[0]!,
});
for (let i = 0; i < 10; i++) {
	await addRecruitmentParticipant({ recruitmentId: closedRec.id, userId: userIds[i]! });
	await setRecruitmentRoles(closedRec.id, userIds[i]!, [ROLES[i % 5]!]);
}
await setRecruitmentStatus(closedRec.id, "CLOSED");
console.log(`  closed recruitment: #${closedRec.id} (10/10명, /팀짜기 가능)`);

// 5. IN_PROGRESS 시리즈 — 1게임 종료, 1팀 1-0
const ip = await createSeries({
	seasonId: season.id,
	createdBy: userIds[0]!,
	participants: ROLES.flatMap((role, i) => [
		{ userId: userIds[i]!, team: "TEAM_1" as const, role },
		{ userId: userIds[i + 5]!, team: "TEAM_2" as const, role },
	]),
});
await recordGameAndUpdateMmr({
	seriesId: ip.id,
	gameNumber: 1,
	winningTeam: "TEAM_1",
	team1Side: "BLUE",
});
console.log(`  in-progress series: #${ip.id} (1팀 1-0)`);

// 6. COMPLETED 시리즈 — 2-1, 다른 10명
const done = await createSeries({
	seasonId: season.id,
	createdBy: userIds[10]!,
	participants: ROLES.flatMap((role, i) => [
		{ userId: userIds[i + 10]!, team: "TEAM_1" as const, role },
		{ userId: userIds[(i + 15) % NAMES.length]!, team: "TEAM_2" as const, role },
	]),
});
await recordGameAndUpdateMmr({
	seriesId: done.id,
	gameNumber: 1,
	winningTeam: "TEAM_1",
	team1Side: "BLUE",
});
await recordGameAndUpdateMmr({
	seriesId: done.id,
	gameNumber: 2,
	winningTeam: "TEAM_2",
	team1Side: "RED",
});
await recordGameAndUpdateMmr({
	seriesId: done.id,
	gameNumber: 3,
	winningTeam: "TEAM_1",
	team1Side: "BLUE",
});
await completeSeries(done.id, "TEAM_1");
console.log(`  completed series: #${done.id} (2-1)`);

console.log("[seed] done. /진행중, /랭킹, /내전모집, /팀짜기 등으로 임베드 확인 가능.");
