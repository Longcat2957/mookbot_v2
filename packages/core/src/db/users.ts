import { batch, execute, query, queryOne } from "../cloudflare/d1.js";
import { inClause } from "./sql.js";

export interface UserRow {
	discord_id: string;
	display_name: string;
	created_at: number;
}

export interface RiotAccountRow {
	puuid: string;
	user_id: string;
	game_name: string;
	tag_line: string;
	is_main: 0 | 1;
	profile_icon_id: number | null;
	created_at: number;
	updated_at: number;
}

export async function upsertUser(discordId: string, displayName: string): Promise<void> {
	await execute(
		`INSERT INTO users (discord_id, display_name) VALUES (?, ?)
		 ON CONFLICT(discord_id) DO UPDATE SET display_name = excluded.display_name
		 WHERE users.display_name <> excluded.display_name`,
		[discordId, displayName],
	);
}

export async function getUser(discordId: string): Promise<UserRow | undefined> {
	return queryOne<UserRow>("SELECT * FROM users WHERE discord_id = ?", [discordId]);
}

export async function listUsers(discordIds: readonly string[]): Promise<UserRow[]> {
	if (discordIds.length === 0) return [];
	const { placeholders, params } = inClause(discordIds);
	return query<UserRow>(`SELECT * FROM users WHERE discord_id IN ${placeholders}`, params);
}

/**
 * Link a Riot account to a user. Idempotent: re-linking the same puuid updates
 * name/tagline (그리고 profileIconId 가 주어지면 그것도). setMain 기본 true 면
 * 기존 메인을 demote.
 */
export async function linkRiotAccount(input: {
	userId: string;
	puuid: string;
	gameName: string;
	tagLine: string;
	setMain?: boolean;
	profileIconId?: number | null;
}): Promise<void> {
	const setMain = input.setMain ?? true;
	const stmts = [];

	if (setMain) {
		stmts.push({
			sql: `UPDATE riot_accounts SET is_main = 0
			      WHERE user_id = ? AND is_main = 1`,
			params: [input.userId],
		});
	}

	// profile_icon_id 는 기존 값을 보존 (UPDATE 시 NULL 로 덮지 않음). NULL 아닌 입력만 갱신.
	stmts.push({
		sql: `INSERT INTO riot_accounts (puuid, user_id, game_name, tag_line, is_main, profile_icon_id)
		      VALUES (?, ?, ?, ?, ?, ?)
		      ON CONFLICT(puuid) DO UPDATE SET
		        user_id = excluded.user_id,
		        game_name = excluded.game_name,
		        tag_line = excluded.tag_line,
		        is_main = excluded.is_main,
		        profile_icon_id = COALESCE(excluded.profile_icon_id, riot_accounts.profile_icon_id),
		        updated_at = unixepoch()`,
		params: [
			input.puuid,
			input.userId,
			input.gameName,
			input.tagLine,
			setMain ? 1 : 0,
			input.profileIconId ?? null,
		],
	});

	await batch(stmts);
}

export async function getMainRiotAccount(userId: string): Promise<RiotAccountRow | undefined> {
	return queryOne<RiotAccountRow>(
		`SELECT * FROM riot_accounts WHERE user_id = ? AND is_main = 1 LIMIT 1`,
		[userId],
	);
}

export async function listMainRiotAccounts(userIds: readonly string[]): Promise<RiotAccountRow[]> {
	if (userIds.length === 0) return [];
	const { placeholders, params } = inClause(userIds);
	return query<RiotAccountRow>(
		`SELECT * FROM riot_accounts WHERE is_main = 1 AND user_id IN ${placeholders}`,
		params,
	);
}

export async function getRiotAccountsByUser(userId: string): Promise<RiotAccountRow[]> {
	return query<RiotAccountRow>(
		`SELECT * FROM riot_accounts WHERE user_id = ? ORDER BY is_main DESC, created_at`,
		[userId],
	);
}

export async function getUserByPuuid(puuid: string): Promise<UserRow | undefined> {
	return queryOne<UserRow>(
		`SELECT u.* FROM users u
		 JOIN riot_accounts ra ON ra.user_id = u.discord_id
		 WHERE ra.puuid = ?`,
		[puuid],
	);
}

export async function getRiotAccountByPuuid(puuid: string): Promise<RiotAccountRow | undefined> {
	return queryOne<RiotAccountRow>(`SELECT * FROM riot_accounts WHERE puuid = ?`, [puuid]);
}

/**
 * Riot 계정 신원만 upsert — `is_main` 은 절대 건드리지 않는다.
 *   - PUUID 신규: is_main = 0 으로 INSERT (sub 로 추가)
 *   - PUUID 존재: game_name / tag_line / user_id 만 갱신 (rename 반영). profile_icon_id 는 입력이 있을 때만 갱신.
 *
 * 메인 승격이 필요하면 `setMainRiotAccount()` 를 별도 호출.
 */
export async function upsertRiotAccountIdentity(input: {
	userId: string;
	puuid: string;
	gameName: string;
	tagLine: string;
	profileIconId?: number | null;
}): Promise<void> {
	await execute(
		`INSERT INTO riot_accounts (puuid, user_id, game_name, tag_line, is_main, profile_icon_id)
		 VALUES (?, ?, ?, ?, 0, ?)
		 ON CONFLICT(puuid) DO UPDATE SET
		   user_id          = excluded.user_id,
		   game_name        = excluded.game_name,
		   tag_line         = excluded.tag_line,
		   profile_icon_id  = COALESCE(excluded.profile_icon_id, riot_accounts.profile_icon_id),
		   updated_at       = unixepoch()`,
		[input.puuid, input.userId, input.gameName, input.tagLine, input.profileIconId ?? null],
	);
}

/**
 * 메인 라이엇 계정의 profile_icon_id 만 갱신. 백필 스크립트 / 주기 갱신용.
 */
export async function setRiotAccountProfileIcon(
	puuid: string,
	profileIconId: number,
): Promise<void> {
	await execute(
		`UPDATE riot_accounts SET profile_icon_id = ?, updated_at = unixepoch() WHERE puuid = ?`,
		[profileIconId, puuid],
	);
}

/**
 * 한 사용자의 라이엇 계정 1개 연결 해제. 메인이든 sub 든 무조건 삭제.
 * auto-promote 없음 — 메인을 지우면 다른 sub 가 자동 승격되지 않는다 (사용자 명시 액션).
 * user_id 일치 가드 — 다른 사용자의 puuid 를 잘못 지정해도 영향 없음.
 *
 * @returns 실제 삭제된 행 수 (0 = 그 사용자에게 그 puuid 없음)
 */
export async function unlinkRiotAccount(userId: string, puuid: string): Promise<number> {
	const result = await execute(`DELETE FROM riot_accounts WHERE user_id = ? AND puuid = ?`, [
		userId,
		puuid,
	]);
	return result.changes ?? 0;
}

/**
 * 한 사용자의 메인 계정 변경 — 기존 메인을 demote 하고 지정 PUUID 를 promote.
 * 지정 PUUID 가 그 사용자의 riot_accounts 에 없으면 아무 효과 없음.
 */
export async function setMainRiotAccount(userId: string, puuid: string): Promise<void> {
	await batch([
		{
			sql: `UPDATE riot_accounts SET is_main = 0 WHERE user_id = ? AND is_main = 1`,
			params: [userId],
		},
		{
			sql: `UPDATE riot_accounts SET is_main = 1 WHERE puuid = ? AND user_id = ?`,
			params: [puuid, userId],
		},
	]);
}

/**
 * Discord display_name 또는 Riot game_name 부분일치 검색 (LIKE %q%).
 * 한 user 가 두 조건 모두 매칭해도 1행 (DISTINCT). limit clamp 1..50.
 */
export async function searchUsers(input: { query: string; limit?: number }): Promise<UserRow[]> {
	const q = input.query.trim();
	if (!q) return [];
	const like = `%${q}%`;
	const limit = Math.max(1, Math.min(50, input.limit ?? 10));
	return query<UserRow>(
		`SELECT DISTINCT u.discord_id, u.display_name, u.created_at
		 FROM users u
		 LEFT JOIN riot_accounts ra ON ra.user_id = u.discord_id
		 WHERE u.display_name LIKE ?
		    OR (ra.game_name IS NOT NULL AND ra.game_name LIKE ?)
		 ORDER BY u.display_name
		 LIMIT ?`,
		[like, like, limit],
	);
}
