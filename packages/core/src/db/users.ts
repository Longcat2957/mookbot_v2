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
	return query<UserRow>(
		`SELECT * FROM users WHERE discord_id IN ${placeholders}`,
		params,
	);
}

/**
 * Link a Riot account to a user. Idempotent: re-linking the same puuid updates
 * name/tagline. If `setMain` is true (default), demotes any current main account.
 */
export async function linkRiotAccount(input: {
	userId: string;
	puuid: string;
	gameName: string;
	tagLine: string;
	setMain?: boolean;
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

	stmts.push({
		sql: `INSERT INTO riot_accounts (puuid, user_id, game_name, tag_line, is_main)
		      VALUES (?, ?, ?, ?, ?)
		      ON CONFLICT(puuid) DO UPDATE SET
		        user_id = excluded.user_id,
		        game_name = excluded.game_name,
		        tag_line = excluded.tag_line,
		        is_main = excluded.is_main,
		        updated_at = unixepoch()`,
		params: [input.puuid, input.userId, input.gameName, input.tagLine, setMain ? 1 : 0],
	});

	await batch(stmts);
}

export async function getMainRiotAccount(userId: string): Promise<RiotAccountRow | undefined> {
	return queryOne<RiotAccountRow>(
		`SELECT * FROM riot_accounts WHERE user_id = ? AND is_main = 1 LIMIT 1`,
		[userId],
	);
}

export async function listMainRiotAccounts(
	userIds: readonly string[],
): Promise<RiotAccountRow[]> {
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
 *   - PUUID 존재: game_name / tag_line / user_id 만 갱신 (rename 반영)
 *
 * 메인 승격이 필요하면 `setMainRiotAccount()` 를 별도 호출.
 */
export async function upsertRiotAccountIdentity(input: {
	userId: string;
	puuid: string;
	gameName: string;
	tagLine: string;
}): Promise<void> {
	await execute(
		`INSERT INTO riot_accounts (puuid, user_id, game_name, tag_line, is_main)
		 VALUES (?, ?, ?, ?, 0)
		 ON CONFLICT(puuid) DO UPDATE SET
		   user_id    = excluded.user_id,
		   game_name  = excluded.game_name,
		   tag_line   = excluded.tag_line,
		   updated_at = unixepoch()`,
		[input.puuid, input.userId, input.gameName, input.tagLine],
	);
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
