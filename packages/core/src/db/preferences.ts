import { batch, query } from "../cloudflare/d1.js";
import type { Role } from "../mmr/elo.js";

export interface UserChampionPreferenceRow {
	user_id: string;
	role: Role;
	champion_id: number;
	position: number;
}

/**
 * 사용자의 모든 라인 선호 챔프 풀. 라인별 position 오름차순.
 */
export async function getUserChampionPreferences(
	userId: string,
): Promise<UserChampionPreferenceRow[]> {
	return query<UserChampionPreferenceRow>(
		`SELECT user_id, role, champion_id, position
		 FROM user_champion_preferences
		 WHERE user_id = ?
		 ORDER BY role, position`,
		[userId],
	);
}

/**
 * 한 라인의 선호 챔프 풀을 atomic 하게 교체.
 * championIds 의 배열 순서 = position(0..N-1). 중복은 첫 발견만 유지.
 * 빈 배열이면 해당 라인 전체 삭제.
 */
export async function setUserLaneChampionPreferences(input: {
	userId: string;
	role: Role;
	championIds: readonly number[];
}): Promise<void> {
	const stmts: { sql: string; params: unknown[] }[] = [
		{
			sql: `DELETE FROM user_champion_preferences WHERE user_id = ? AND role = ?`,
			params: [input.userId, input.role],
		},
	];
	const seen = new Set<number>();
	let pos = 0;
	for (const id of input.championIds) {
		if (seen.has(id)) continue;
		seen.add(id);
		stmts.push({
			sql: `INSERT INTO user_champion_preferences (user_id, role, champion_id, position)
			      VALUES (?, ?, ?, ?)`,
			params: [input.userId, input.role, id, pos++],
		});
	}
	await batch(stmts);
}
