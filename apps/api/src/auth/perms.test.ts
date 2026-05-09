// userCanEdit 캐시 정책 회귀 테스트.
// v0.3.27 fix: fetchGuildMember 일시 실패가 빈 배열로 60s 캐시되어 운영자가
// 권한 없는 사용자로 취급되던 버그 (Activity 껐다 켜야 회복).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __setCanEditOverrideForTest, clearPermsCache, userCanEdit } from "./perms.js";

const ROLES_URL_TAIL = "/roles";

describe("userCanEdit cache behavior", () => {
	const originalFetch = global.fetch;
	const originalGuildId = process.env.GUILD_ID;
	const originalToken = process.env.DISCORD_TOKEN;
	const originalRoleName = process.env.OPERATOR_ROLE_NAME;

	beforeEach(() => {
		__setCanEditOverrideForTest(null);
		clearPermsCache();
		process.env.GUILD_ID = "g1";
		process.env.DISCORD_TOKEN = "tok";
		process.env.OPERATOR_ROLE_NAME = "BalanceTeam";
	});

	afterEach(() => {
		global.fetch = originalFetch;
		clearPermsCache();
		process.env.GUILD_ID = originalGuildId;
		process.env.DISCORD_TOKEN = originalToken;
		process.env.OPERATOR_ROLE_NAME = originalRoleName;
	});

	it("길드 멤버 fetch 일시 실패는 캐시되지 않아 다음 요청에 재시도 가능", async () => {
		let memberFetchCount = 0;
		global.fetch = vi.fn(async (url: string | URL | Request) => {
			const u = String(url);
			if (u.endsWith(ROLES_URL_TAIL)) {
				return new Response(JSON.stringify([{ id: "rid", name: "BalanceTeam" }]), {
					status: 200,
				});
			}
			memberFetchCount++;
			if (memberFetchCount === 1) {
				return new Response("rate limited", { status: 429 });
			}
			return new Response(JSON.stringify({ roles: ["rid"] }), { status: 200 });
		}) as typeof fetch;

		// 첫 호출 — fetch 429 → fail-secure deny, 캐시 X
		expect(await userCanEdit("u1")).toBe(false);
		// 두 번째 호출 — 재시도, 정상 응답 → true
		expect(await userCanEdit("u1")).toBe(true);
		expect(memberFetchCount).toBe(2);
	});

	it("정상 응답 (역할 0개 포함) 은 60s 캐시 — 재호출 시 fetch 안 함", async () => {
		let memberFetchCount = 0;
		global.fetch = vi.fn(async (url: string | URL | Request) => {
			const u = String(url);
			if (u.endsWith(ROLES_URL_TAIL)) {
				return new Response(JSON.stringify([{ id: "rid", name: "BalanceTeam" }]), {
					status: 200,
				});
			}
			memberFetchCount++;
			return new Response(JSON.stringify({ roles: [] }), { status: 200 });
		}) as typeof fetch;

		// 진짜 권한 없는 사용자 — false 캐시됨
		expect(await userCanEdit("u2")).toBe(false);
		expect(await userCanEdit("u2")).toBe(false);
		expect(memberFetchCount).toBe(1);
	});

	it("정상 응답 (역할 보유) 도 60s 캐시", async () => {
		let memberFetchCount = 0;
		global.fetch = vi.fn(async (url: string | URL | Request) => {
			const u = String(url);
			if (u.endsWith(ROLES_URL_TAIL)) {
				return new Response(JSON.stringify([{ id: "rid", name: "BalanceTeam" }]), {
					status: 200,
				});
			}
			memberFetchCount++;
			return new Response(JSON.stringify({ roles: ["rid"] }), { status: 200 });
		}) as typeof fetch;

		expect(await userCanEdit("u3")).toBe(true);
		expect(await userCanEdit("u3")).toBe(true);
		expect(memberFetchCount).toBe(1);
	});
});
