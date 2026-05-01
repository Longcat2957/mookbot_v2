// Discord 길드 멤버 role 기반 권한 검증.
// OPERATOR_ROLE_ID 가 설정된 경우 해당 role 보유자만 쓰기 가능,
// 미설정 시 모든 인증 사용자 허용 (fallback).

interface MemberCacheEntry {
	roles: string[];
	expiresAt: number;
}

interface RoleInfo {
	id: string;
	name: string;
}

const memberCache = new Map<string, MemberCacheEntry>();
const TTL_MS = 60 * 1000;
let rolesCache: { roles: RoleInfo[]; expiresAt: number } | null = null;

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

async function getRoles(userId: string): Promise<string[]> {
	const cached = memberCache.get(userId);
	const now = Date.now();
	if (cached && cached.expiresAt > now) return cached.roles;

	const member = await fetchGuildMember(userId);
	const roles = member?.roles ?? [];
	memberCache.set(userId, { roles, expiresAt: now + TTL_MS });
	return roles;
}

async function resolveOperatorRoleId(): Promise<string | null> {
	const id = process.env.OPERATOR_ROLE_ID?.trim();
	if (id) return id;
	const name = process.env.OPERATOR_ROLE_NAME?.trim();
	if (!name) return null;
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
 * - OPERATOR_ROLE_ID / OPERATOR_ROLE_NAME 미설정 시 → 모든 사용자 허용
 * - 설정 시 → 해당 role 보유자만 true
 */
export async function userCanEdit(userId: string): Promise<boolean> {
	const operatorRoleId = await resolveOperatorRoleId();
	if (!operatorRoleId) {
		console.log(`[perms] no operator role configured — all users can edit`);
		return true;
	}
	const roles = await getRoles(userId);
	const ok = roles.includes(operatorRoleId);
	console.log(
		`[perms] user=${userId} operatorRole=${operatorRoleId} userRoles=[${roles.join(",")}] canEdit=${ok}`,
	);
	return ok;
}

/**
 * 진단용 — userId 의 권한 상태 + 길드 role 매핑 전체.
 */
export async function diagnosePerms(userId: string): Promise<{
	operatorRoleIdEnv: string | null;
	operatorRoleNameEnv: string | null;
	resolvedOperatorRoleId: string | null;
	guildRoles: { id: string; name: string }[];
	memberRoles: string[];
	memberFetchOk: boolean;
	canEdit: boolean;
}> {
	const idEnv = process.env.OPERATOR_ROLE_ID?.trim() || null;
	const nameEnv = process.env.OPERATOR_ROLE_NAME?.trim() || null;
	const resolved = await resolveOperatorRoleId();
	const guildRoles = await fetchGuildRoles();
	const member = await fetchGuildMember(userId);
	const memberRoles = member?.roles ?? [];
	let canEdit: boolean;
	if (!resolved) canEdit = true;
	else canEdit = memberRoles.includes(resolved);
	return {
		operatorRoleIdEnv: idEnv,
		operatorRoleNameEnv: nameEnv,
		resolvedOperatorRoleId: resolved,
		guildRoles,
		memberRoles,
		memberFetchOk: member !== null,
		canEdit,
	};
}
