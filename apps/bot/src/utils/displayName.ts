// 사용자 표시 이름 단일 진입점.
//
// 어떤 경우에도 **GuildMember.displayName 이 가장 먼저** 사용되어야 한다.
// (서버 닉네임 → 글로벌 display name → username 순으로 fallback —
//  이 chain 은 discord.js 의 GuildMember.displayName 안에 이미 구현되어 있음)
//
// 이전 버그: `interaction.user.displayName` 를 직접 사용해 글로벌 display name
// (혹은 미설정 시 username) 이 DB 의 users.display_name 에 박혀버림.
// upsertUser 가 ON CONFLICT DO UPDATE 라서 한 번이라도 잘못 호출되면
// 정상 닉네임이 username 으로 덮어쓰여짐. 따라서 모든 호출처가 이 헬퍼를
// 거치도록 강제한다.

import type { Guild, GuildMember, User } from "discord.js";

/**
 * userId 의 길드 닉네임을 반환. 길드가 없거나 fetch 실패 시 글로벌 fallback.
 *
 * 우선순위:
 *   1. GuildMember.displayName  (서버 닉 → globalName → username — discord.js 내부 chain)
 *   2. User.displayName         (globalName → username — 길드 외부 / fetch 실패)
 *   3. User.username            (안전망)
 */
export async function resolveGuildDisplayName(
	guild: Guild | null,
	user: Pick<User, "id" | "displayName" | "username">,
): Promise<string> {
	if (guild) {
		try {
			const member = await guild.members.fetch(user.id);
			return member.displayName;
		} catch {
			// 봇이 멤버 fetch 권한이 없거나 사용자가 길드를 떠난 경우 → 다음 단계
		}
	}
	return user.displayName ?? user.username;
}

/**
 * 이미 GuildMember 핸들이 있을 때의 직접 추출.
 * (예: bulkRegister 가 guild.members.fetch() 로 전체 collection 을 가져온 뒤 순회)
 */
export function displayNameOf(member: GuildMember): string {
	return member.displayName;
}
