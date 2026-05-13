// /api/me/riot-accounts/* 통합 테스트.
// Riot API 는 global.fetch mock 으로 처리.

// riotClient 는 lazy 생성자에서 process.env.RIOT_API_KEY 를 검사 — 테스트 환경에선
// 실제 키 불요. 첫 호출 전에 더미 키만 set 하면 mock fetch 로 우회.
process.env.RIOT_API_KEY ||= "test-riot-key";

import { riot } from "@mookbot/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTestApp, signSid } from "../test-utils/build-app.js";

const ME = "discord-me";
const OTHER = "discord-other";

interface MockOptions {
	accountByRiotId?: { gameName: string; tagLine: string; puuid: string } | "fail";
	accountByPuuid?: { gameName: string; tagLine: string; puuid: string } | "fail";
	summonerByPuuid?: { profileIconId: number } | "fail";
}

function installFetchMock(opts: MockOptions = {}): void {
	global.fetch = vi.fn(async (url: string | URL | Request) => {
		const u = String(url);
		if (u.includes("/accounts/by-riot-id/")) {
			if (opts.accountByRiotId === "fail" || !opts.accountByRiotId) {
				return new Response("not found", { status: 404 });
			}
			return new Response(JSON.stringify(opts.accountByRiotId), { status: 200 });
		}
		if (u.includes("/accounts/by-puuid/")) {
			if (opts.accountByPuuid === "fail" || !opts.accountByPuuid) {
				return new Response("not found", { status: 404 });
			}
			return new Response(JSON.stringify(opts.accountByPuuid), { status: 200 });
		}
		if (u.includes("/summoners/by-puuid/")) {
			if (opts.summonerByPuuid === "fail" || !opts.summonerByPuuid) {
				return new Response("fail", { status: 500 });
			}
			return new Response(JSON.stringify(opts.summonerByPuuid), { status: 200 });
		}
		return new Response("not stubbed", { status: 599 });
	}) as typeof fetch;
}

function seedUser(db: ReturnType<typeof Object>, discordId: string, name: string): void {
	(db as { prepare: (s: string) => { run: (...a: unknown[]) => void } })
		.prepare("INSERT INTO users (discord_id, display_name) VALUES (?, ?)")
		.run(discordId, name);
}

function seedRiotAccount(
	db: ReturnType<typeof Object>,
	args: {
		userId: string;
		puuid: string;
		gameName: string;
		tagLine: string;
		isMain: 0 | 1;
	},
): void {
	(db as { prepare: (s: string) => { run: (...a: unknown[]) => void } })
		.prepare(
			"INSERT INTO riot_accounts (puuid, user_id, game_name, tag_line, is_main) VALUES (?, ?, ?, ?, ?)",
		)
		.run(args.puuid, args.userId, args.gameName, args.tagLine, args.isMain);
}

const originalFetch = global.fetch;

beforeEach(() => {
	// riotClient 모듈 캐시는 테스트간 공유 — mock fetch 결과 격리를 위해 매번 비움.
	riot.__clearRiotCacheForTest();
});

afterEach(() => {
	global.fetch = originalFetch;
});

describe("GET /api/me/riot-accounts", () => {
	it("미인증 → 401", async () => {
		const { app } = await buildTestApp();
		const res = await app.inject({ method: "GET", url: "/api/me/riot-accounts" });
		expect(res.statusCode).toBe(401);
	});

	it("본인 계정만 main first 정렬", async () => {
		const { app, db } = await buildTestApp();
		seedUser(db, ME, "Me");
		seedUser(db, OTHER, "Other");
		seedRiotAccount(db, { userId: ME, puuid: "p1", gameName: "Sub", tagLine: "S", isMain: 0 });
		seedRiotAccount(db, { userId: ME, puuid: "p2", gameName: "Main", tagLine: "M", isMain: 1 });
		seedRiotAccount(db, { userId: OTHER, puuid: "p3", gameName: "Else", tagLine: "E", isMain: 1 });

		const res = await app.inject({
			method: "GET",
			url: "/api/me/riot-accounts",
			cookies: { sid: signSid(app, ME) },
		});
		expect(res.statusCode).toBe(200);
		const body = res.json() as { accounts: { puuid: string; isMain: boolean }[] };
		expect(body.accounts).toHaveLength(2);
		expect(body.accounts[0]?.puuid).toBe("p2"); // main first
		expect(body.accounts[0]?.isMain).toBe(true);
		expect(body.accounts[1]?.puuid).toBe("p1");
	});
});

describe("POST /api/me/riot-accounts (link)", () => {
	beforeEach(() => {
		installFetchMock({
			accountByRiotId: { puuid: "p-new", gameName: "Hide on bush", tagLine: "KR1" },
			summonerByPuuid: { profileIconId: 4567 },
		});
	});

	it("riotId 누락 → 400", async () => {
		const { app, db } = await buildTestApp();
		seedUser(db, ME, "Me");
		const res = await app.inject({
			method: "POST",
			url: "/api/me/riot-accounts",
			cookies: { sid: signSid(app, ME) },
			payload: {},
		});
		expect(res.statusCode).toBe(400);
	});

	it("형식 오류 (#없음) → 400", async () => {
		const { app, db } = await buildTestApp();
		seedUser(db, ME, "Me");
		const res = await app.inject({
			method: "POST",
			url: "/api/me/riot-accounts",
			cookies: { sid: signSid(app, ME) },
			payload: { riotId: "no-tag" },
		});
		expect(res.statusCode).toBe(400);
	});

	it("첫 계정 → 자동 메인", async () => {
		const { app, db } = await buildTestApp();
		seedUser(db, ME, "Me");
		const res = await app.inject({
			method: "POST",
			url: "/api/me/riot-accounts",
			cookies: { sid: signSid(app, ME) },
			payload: { riotId: "Hide on bush#KR1" },
		});
		expect(res.statusCode).toBe(200);
		const body = res.json() as { account: { isMain: boolean; puuid: string } };
		expect(body.account.isMain).toBe(true);
		expect(body.account.puuid).toBe("p-new");
	});

	it("두 번째 계정 → sub 로 추가, 기존 메인 유지", async () => {
		const { app, db } = await buildTestApp();
		seedUser(db, ME, "Me");
		seedRiotAccount(db, {
			userId: ME,
			puuid: "p-existing",
			gameName: "Existing",
			tagLine: "E",
			isMain: 1,
		});

		const res = await app.inject({
			method: "POST",
			url: "/api/me/riot-accounts",
			cookies: { sid: signSid(app, ME) },
			payload: { riotId: "Hide on bush#KR1" },
		});
		expect(res.statusCode).toBe(200);
		const body = res.json() as { account: { isMain: boolean; puuid: string } };
		expect(body.account.isMain).toBe(false);

		// existing main 유지 확인
		const existingMain = (
			db as unknown as { prepare: (s: string) => { get: (...a: unknown[]) => unknown } }
		)
			.prepare("SELECT is_main FROM riot_accounts WHERE puuid = ?")
			.get("p-existing") as { is_main: number };
		expect(existingMain.is_main).toBe(1);
	});

	it("이미 다른 사용자에게 연결된 puuid → 409", async () => {
		const { app, db } = await buildTestApp();
		seedUser(db, ME, "Me");
		seedUser(db, OTHER, "Other");
		seedRiotAccount(db, {
			userId: OTHER,
			puuid: "p-new",
			gameName: "Taken",
			tagLine: "T",
			isMain: 1,
		});

		const res = await app.inject({
			method: "POST",
			url: "/api/me/riot-accounts",
			cookies: { sid: signSid(app, ME) },
			payload: { riotId: "Hide on bush#KR1" },
		});
		expect(res.statusCode).toBe(409);
	});
});

describe("DELETE /api/me/riot-accounts/:puuid", () => {
	it("다른 사용자의 puuid → 404 (격리)", async () => {
		const { app, db } = await buildTestApp();
		seedUser(db, ME, "Me");
		seedUser(db, OTHER, "Other");
		seedRiotAccount(db, {
			userId: OTHER,
			puuid: "p-other",
			gameName: "Other",
			tagLine: "O",
			isMain: 1,
		});

		const res = await app.inject({
			method: "DELETE",
			url: "/api/me/riot-accounts/p-other",
			cookies: { sid: signSid(app, ME) },
		});
		expect(res.statusCode).toBe(404);

		const stillThere = (
			db as unknown as { prepare: (s: string) => { get: (...a: unknown[]) => unknown } }
		)
			.prepare("SELECT 1 FROM riot_accounts WHERE puuid = ?")
			.get("p-other");
		expect(stillThere).toBeTruthy();
	});

	it("본인 메인 삭제 — 작동 (auto-promote 없음)", async () => {
		const { app, db } = await buildTestApp();
		seedUser(db, ME, "Me");
		seedRiotAccount(db, {
			userId: ME,
			puuid: "p-main",
			gameName: "Main",
			tagLine: "M",
			isMain: 1,
		});
		seedRiotAccount(db, { userId: ME, puuid: "p-sub", gameName: "Sub", tagLine: "S", isMain: 0 });

		const res = await app.inject({
			method: "DELETE",
			url: "/api/me/riot-accounts/p-main",
			cookies: { sid: signSid(app, ME) },
		});
		expect(res.statusCode).toBe(200);

		// 메인 삭제됨 + 남은 sub 는 그대로 sub (auto-promote 없음)
		const remaining = (
			db as unknown as { prepare: (s: string) => { all: (...a: unknown[]) => unknown[] } }
		)
			.prepare("SELECT puuid, is_main FROM riot_accounts WHERE user_id = ?")
			.all(ME) as { puuid: string; is_main: number }[];
		expect(remaining).toHaveLength(1);
		expect(remaining[0]?.puuid).toBe("p-sub");
		expect(remaining[0]?.is_main).toBe(0);
	});

	it("마지막 계정 삭제 — 작동 (계정 0개 상태 허용)", async () => {
		const { app, db } = await buildTestApp();
		seedUser(db, ME, "Me");
		seedRiotAccount(db, {
			userId: ME,
			puuid: "p-only",
			gameName: "Only",
			tagLine: "O",
			isMain: 1,
		});

		const res = await app.inject({
			method: "DELETE",
			url: "/api/me/riot-accounts/p-only",
			cookies: { sid: signSid(app, ME) },
		});
		expect(res.statusCode).toBe(200);

		const left = (
			db as unknown as { prepare: (s: string) => { all: (...a: unknown[]) => unknown[] } }
		)
			.prepare("SELECT 1 FROM riot_accounts WHERE user_id = ?")
			.all(ME);
		expect(left).toHaveLength(0);
	});
});

describe("PUT /api/me/riot-accounts/:puuid/main", () => {
	it("sub → main 전환, 기존 메인 demote", async () => {
		const { app, db } = await buildTestApp();
		seedUser(db, ME, "Me");
		seedRiotAccount(db, {
			userId: ME,
			puuid: "p-old-main",
			gameName: "Old",
			tagLine: "O",
			isMain: 1,
		});
		seedRiotAccount(db, {
			userId: ME,
			puuid: "p-promote",
			gameName: "Up",
			tagLine: "U",
			isMain: 0,
		});

		const res = await app.inject({
			method: "PUT",
			url: "/api/me/riot-accounts/p-promote/main",
			cookies: { sid: signSid(app, ME) },
		});
		expect(res.statusCode).toBe(200);

		const rows = (
			db as unknown as { prepare: (s: string) => { all: (...a: unknown[]) => unknown[] } }
		)
			.prepare("SELECT puuid, is_main FROM riot_accounts WHERE user_id = ?")
			.all(ME) as { puuid: string; is_main: number }[];
		const map = new Map(rows.map((r) => [r.puuid, r.is_main]));
		expect(map.get("p-old-main")).toBe(0);
		expect(map.get("p-promote")).toBe(1);
	});

	it("다른 사용자의 puuid → 404", async () => {
		const { app, db } = await buildTestApp();
		seedUser(db, ME, "Me");
		seedUser(db, OTHER, "Other");
		seedRiotAccount(db, {
			userId: OTHER,
			puuid: "p-other",
			gameName: "Other",
			tagLine: "O",
			isMain: 1,
		});

		const res = await app.inject({
			method: "PUT",
			url: "/api/me/riot-accounts/p-other/main",
			cookies: { sid: signSid(app, ME) },
		});
		expect(res.statusCode).toBe(404);
	});
});

describe("POST /api/me/riot-accounts/:puuid/refresh", () => {
	it("Riot API 로 game_name / tag_line 재동기화", async () => {
		installFetchMock({
			accountByPuuid: { puuid: "p-renamed", gameName: "NewName", tagLine: "NEW" },
			summonerByPuuid: { profileIconId: 9999 },
		});

		const { app, db } = await buildTestApp();
		seedUser(db, ME, "Me");
		seedRiotAccount(db, {
			userId: ME,
			puuid: "p-renamed",
			gameName: "OldName",
			tagLine: "OLD",
			isMain: 1,
		});

		const res = await app.inject({
			method: "POST",
			url: "/api/me/riot-accounts/p-renamed/refresh",
			cookies: { sid: signSid(app, ME) },
		});
		expect(res.statusCode).toBe(200);

		const row = (db as unknown as { prepare: (s: string) => { get: (...a: unknown[]) => unknown } })
			.prepare("SELECT game_name, tag_line, is_main FROM riot_accounts WHERE puuid = ?")
			.get("p-renamed") as { game_name: string; tag_line: string; is_main: number };
		expect(row.game_name).toBe("NewName");
		expect(row.tag_line).toBe("NEW");
		expect(row.is_main).toBe(1); // 메인 보존
	});

	it("다른 사용자의 puuid → 404", async () => {
		const { app, db } = await buildTestApp();
		seedUser(db, ME, "Me");
		seedUser(db, OTHER, "Other");
		seedRiotAccount(db, {
			userId: OTHER,
			puuid: "p-other",
			gameName: "Other",
			tagLine: "O",
			isMain: 1,
		});

		const res = await app.inject({
			method: "POST",
			url: "/api/me/riot-accounts/p-other/refresh",
			cookies: { sid: signSid(app, ME) },
		});
		expect(res.statusCode).toBe(404);
	});
});
