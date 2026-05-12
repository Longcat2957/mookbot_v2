// 경매내전 종료 카드 — 토너먼트 COMPLETED 시 모집 채널에 결과 요약 V2 메시지.
//
// 흐름:
//   api 의 completeAuctionTournament() 직후 → notifyBotAuctionTournamentCompleted
//     → 봇 /internal/auction-tournament-completed → publishAuctionEndCard
//
// 멱등성: tournament.end_card_message_id 가 있으면 edit, 없으면 send + DB 갱신.
// (서버측 코드 v0.4.3 의 시리즈 종료 카드 패턴과 동일.)

import { db } from "@mookbot/core";
import {
	type ActionRowBuilder,
	type ButtonBuilder,
	type Client,
	type ContainerBuilder,
	MessageFlags,
	type StringSelectMenuBuilder,
} from "discord.js";
import { COLORS, v2Container, v2Sep, v2Text } from "../../utils/v2.js";

export async function renderEndCardComponents(
	tournamentId: number,
): Promise<Array<
	ContainerBuilder | ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>
> | null> {
	const tournament = await db.getAuctionTournament(tournamentId);
	if (!tournament) return null;
	if (tournament.status !== "COMPLETED" || !tournament.champion_team_id) return null;

	const teams = await db.listAuctionTeams(tournamentId);
	const allMembers = await db.listAuctionTeamMembersByTournament(tournamentId);
	const matches = await db.listAuctionMatches(tournamentId);

	const userIds = new Set<string>();
	for (const t of teams) userIds.add(t.captain_user_id);
	for (const m of allMembers) userIds.add(m.user_id);
	const users = userIds.size > 0 ? await db.listUsers([...userIds]) : [];
	const nameById = new Map(users.map((u) => [u.discord_id, u.display_name]));

	const championTeam = teams.find((t) => t.id === tournament.champion_team_id);
	const championLabel = championTeam
		? `팀${championTeam.team_index} · ${championTeam.team_name ?? nameById.get(championTeam.captain_user_id) ?? championTeam.captain_user_id}`
		: "?";

	const teamMembersByTeam = new Map<number, typeof allMembers>();
	for (const m of allMembers) {
		if (!teamMembersByTeam.has(m.team_id)) teamMembersByTeam.set(m.team_id, []);
		teamMembersByTeam.get(m.team_id)!.push(m);
	}

	const teamRoster = teams
		.map((t) => {
			const members = teamMembersByTeam.get(t.id) ?? [];
			const names = members.map((m) => nameById.get(m.user_id) ?? m.user_id);
			const trophy = t.id === tournament.champion_team_id ? "🏆 " : "";
			return `${trophy}**팀${t.team_index}** (${nameById.get(t.captain_user_id) ?? t.captain_user_id}): ${names.join(", ")}`;
		})
		.join("\n");

	const matchLines: string[] = [];
	for (const m of matches) {
		const t1 = teams.find((t) => t.id === m.team1_id);
		const t2 = teams.find((t) => t.id === m.team2_id);
		matchLines.push(
			`- ${m.round}${m.bracket_index ? ` ${m.bracket_index}` : ""} · ${m.format} — 팀${t1?.team_index} vs 팀${t2?.team_index}`,
		);
	}

	const children = [
		v2Text(`## 🏆 경매내전 #${tournament.id} 종료 — ${championLabel} 우승!`),
		v2Text(`${tournament.format}인 · ${matches.length}매치`),
		v2Sep(),
		v2Text(`### 팀 구성\n${teamRoster}`),
		v2Sep(),
		v2Text(`### 매치 결과\n${matchLines.join("\n")}`),
	];

	return [v2Container({ color: COLORS.success, children })];
}

export async function publishAuctionEndCard(
	client: Client,
	tournamentId: number,
): Promise<string | null> {
	// 모집 channel_id = auction_recruitment.id 와 동일 id 의 모집에서
	const recruitment = await db.getAuctionRecruitment(tournamentId);
	if (!recruitment) return `auction recruitment ${tournamentId} not found`;
	const channelId = recruitment.channel_id;
	if (!channelId) return "auction recruitment has no channel_id (skip)";

	const components = await renderEndCardComponents(tournamentId);
	if (!components) return "tournament not in COMPLETED state (skip)";

	const tournament = await db.getAuctionTournament(tournamentId);
	const existingMessageId = tournament?.end_card_message_id ?? null;
	const existingChannelId = tournament?.end_card_channel_id ?? channelId;

	if (existingMessageId) {
		try {
			const ch = await client.channels.fetch(existingChannelId);
			if (ch?.isTextBased() && "messages" in ch) {
				const msg = await ch.messages.fetch(existingMessageId);
				await msg.edit({
					flags: MessageFlags.IsComponentsV2,
					components,
				} as Parameters<typeof msg.edit>[0]);
				return null;
			}
		} catch (err) {
			const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
			if (!isAccessOrMissingError(err)) {
				return `auction end-card edit 실패: ${detail}`;
			}
		}
	}

	try {
		const ch = await client.channels.fetch(channelId);
		if (!ch?.isTextBased() || !("send" in ch)) {
			return "모집 채널 접근 불가 (텍스트 채널 아님)";
		}
		const newMsg = await ch.send({
			flags: MessageFlags.IsComponentsV2,
			components,
		} as Parameters<typeof ch.send>[0]);
		await db.setAuctionEndCardMessage(tournamentId, newMsg.channelId, newMsg.id);
		return null;
	} catch (err) {
		const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
		return `auction end-card send 실패: ${detail}`;
	}
}

function isAccessOrMissingError(err: unknown): boolean {
	if (!(err instanceof Error)) return false;
	return (
		/50001|10008|50013/.test(err.message) ||
		/50001|10008|50013/.test(err.name) ||
		[50001, 10008, 50013].includes((err as { code?: number }).code ?? -1)
	);
}
