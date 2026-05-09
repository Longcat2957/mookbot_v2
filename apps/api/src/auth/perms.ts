// Discord 길드 멤버 role 기반 쓰기 권한 검증.
// "BalanceTeam" 역할 (env OPERATOR_ROLE_NAME 으로 override) 보유자만 통과.
// 길드에서 역할을 못 찾거나 멤버 fetch 실패 시 fail-secure 로 deny.

import { log } from "@mookbot/core";

interface MemberCacheEntry {
	roles: string[];
	expiresAt: number;
}

interface RoleInfo {
	id: string;
	name: string;
}

const DEFAULT_OPERATOR_ROLE_NAME = "BalanceTeam";

const memberCache = new Map<string, MemberCacheEntry>();
const TTL_MS = 60 * 1000;
let rolesCache: { roles: RoleInfo[]; expiresAt: number } | null = null;

// 테스트 전용 override — 설정 시 모든 권한 검사가 이 값으로 결정.
// vi.resetModules() 가 모듈 캐시를 비워 dynamic/static import 가 다른 인스턴스를
// 반환하는 케이스를 피하려고 globalThis 에 저장 (process-wide singleton).
// production 코드 경로에서는 절대 호출하지 않음.
const TEST_OVERRIDE_KEY = Symbol.for("@mookbot/api/perms/__testOverride");
type GlobalWithOverride = typeof globalThis & { [TEST_OVERRIDE_KEY]?: boolean | null };

function getTestOverride(): boolean | null {
	const v = (globalThis as GlobalWithOverride)[TEST_OVERRIDE_KEY];
	return v ?? null;
}
export function __setCanEditOverrideForTest(v: boolean | null): void {
	(globalThis as GlobalWithOverride)[TEST_OVERRIDE_KEY] = v;
}

function operatorRoleName(): string {
	return process.env.OPERATOR_ROLE_NAME?.trim() || DEFAULT_OPERATOR_ROLE_NAME;
}

async function fetchGuildMember(userId: string): Promise<{ roles: string[] } | null> {
	const guildId = process.env.GUILD_ID;
	const botToken = process.env.DISCORD_TOKEN;
	if (!guildId || !botToken) return null;

	const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
		headers: { Authorization: `Bot ${botToken}` },
	});
	if (!res.ok) return null;
	const data = (await res.json()) as { roles: string[] };
	return { roles: data.roles ?? [] };
}

async function fetchGuildRoles(): Promise<RoleInfo[]> {
	const now = Date.now();
	if (rolesCache && rolesCache.expiresAt > now) return rolesCache.roles;

	const guildId = process.env.GUILD_ID;
	const botToken = process.env.DISCORD_TOKEN;
	if (!guildId || !botToken) return [];

	const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
		headers: { Authorization: `Bot ${botToken}` },
	});
	if (!res.ok) return [];
	const data = (await res.json()) as RoleInfo[];
	rolesCache = { roles: data, expiresAt: now + 5 * 60 * 1000 };
	return data;
}

/**
 * userId 의 길드 역할 목록을 반환. 60s 캐시.
 * fetch 실패 시 null — **캐시하지 않음**. 다음 호출에서 재시도 가능하게 함.
 *
 * 이 구분이 중요한 이유: 빈 배열 (`[]`) 은 "정상 응답이지만 역할 0개" 와
 * "fetch 실패" 를 구분 못 함. 후자를 캐시하면 일시적 Discord API 장애 (rate limit / 5xx) 시
 * 운영자가 60s 동안 권한 없는 사용자로 취급되는 버그가 발생 (v0.3.27 수정).
 */
async function getRoles(userId: string): Promise<string[] | null> {
	const cached = memberCache.get(userId);
	const now = Date.now();
	if (cached && cached.expiresAt > now) return cached.roles;

	const member = await fetchGuildMember(userId);
	if (member === null) return null;
	memberCache.set(userId, { roles: member.roles, expiresAt: now + TTL_MS });
	return member.roles;
}

async function resolveOperatorRoleId(): Promise<string | null> {
	const name = operatorRoleName();
	const roles = await fetchGuildRoles();
	const match = roles.find((r) => r.name === name);
	return match?.id ?? null;
}

export function clearPermsCache(userId?: string): void {
	if (userId) memberCache.delete(userId);
	else memberCache.clear();
	rolesCache = null;
}

/**
 * 쓰기 권한 — 엔트리 수정 / 픽밴 / 결과 입력 등 모든 시리즈 변경.
 *
 * `BalanceTeam` 역할 (또는 OPERATOR_ROLE_NAME 으로 override) 보유자만 true.
 * 역할이 길드에 존재하지 않거나 멤버 fetch 실패 시 false.
 */
export async function userCanEdit(userId: string): Promise<boolean> {
	const override = getTestOverride();
	if (override !== null) return override;
	const operatorRoleId = await resolveOperatorRoleId();
	if (!operatorRoleId) {
		log.warn(
			{ roleName: operatorRoleName() },
			"perms: operator role not found in guild — denying edit",
		);
		return false;
	}
	const roles = await getRoles(userId);
	if (roles === null) {
		// 길드 멤버 fetch 일시 실패 — fail-secure deny. 단 캐시 X 라 다음 요청은 재시도.
		log.warn(
			{ user: userId },
			"perms: guild member fetch failed — denying this request only (no cache poisoning)",
		);
		return false;
	}
	const ok = roles.includes(operatorRoleId);
	log.debug({ user: userId, operatorRoleId, roles, canEdit: ok }, "perms check");
	return ok;
}

/**
 * 진단용 — userId 의 권한 상태 + 길드 role 매핑 전체.
 */
export async function diagnosePerms(userId: string): Promise<{
	operatorRoleName: string;
	resolvedOperatorRoleId: string | null;
	guildRoles: { id: string; name: string }[];
	memberRoles: string[];
	memberFetchOk: boolean;
	canEdit: boolean;
}> {
	const name = operatorRoleName();
	const resolved = await resolveOperatorRoleId();
	const guildRoles = await fetchGuildRoles();
	const member = await fetchGuildMember(userId);
	const memberRoles = member?.roles ?? [];
	const canEdit = resolved !== null && memberRoles.includes(resolved);
	return {
		operatorRoleName: name,
		resolvedOperatorRoleId: resolved,
		guildRoles,
		memberRoles,
		memberFetchOk: member !== null,
		canEdit,
	};
}
