// 경매내전 매치업 공지 카드 — 팀장 매치업 보고 직후 모집 채널에 발행.

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

export async function renderAuctionMatchupComponents(
	matchId: number,
): Promise<Array<
	ContainerBuilder | ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>
> | null> {
	const match = await db.getAuctionMatch(matchId);
	if (!match) return null;
	const [tournament, teams] = await Promise.all([
		db.getAuctionTournament(match.tournament_id),
		db.listAuctionTeams(match.tournament_id),
	]);
	if (!tournament) return null;

	const team1 = teams.find((t) => t.id === match.team1_id);
	const team2 = teams.find((t) => t.id === match.team2_id);
	if (!team1 || !team2) return null;

	const [team1Members, team2Members] = await Promise.all([
		db.listAuctionTeamMembers(team1.id),
		db.listAuctionTeamMembers(team2.id),
	]);
	const userIds = new Set<string>([
		team1.captain_user_id,
		team2.captain_user_id,
		...team1Members.map((m) => m.user_id),
		...team2Members.map((m) => m.user_id),
	]);
	const users = userIds.size > 0 ? await db.listUsers([...userIds]) : [];
	const nameById = new Map(users.map((u) => [u.discord_id, u.display_name]));

	const round = roundLabel(match.round, match.bracket_index);
	const team1Label = teamLabel(team1, nameById);
	const team2Label = teamLabel(team2, nameById);
	const children = [
		v2Text(`## 경매내전 #${tournament.id} ${round} 매치업 공지`),
		v2Text(`${match.format} · **${team1Label}** vs **${team2Label}**`),
		v2Sep(),
		v2Text(`### 팀${team1.team_index} 라인업\n${memberNames(team1Members, nameById)}`),
		v2Text(`### 팀${team2.team_index} 라인업\n${memberNames(team2Members, nameById)}`),
	];

	return [v2Container({ color: COLORS.info, children })];
}

export async function publishAuctionMatchupCard(
	client: Client,
	matchId: number,
): Promise<string | null> {
	const match = await db.getAuctionMatch(matchId);
	if (!match) return `auction match ${matchId} not found`;
	const recruitment = await db.getAuctionRecruitment(match.tournament_id);
	if (!recruitment) return `auction recruitment ${match.tournament_id} not found`;
	const channelId = recruitment.channel_id;
	if (!channelId) return "auction recruitment has no channel_id (skip)";

	const components = await renderAuctionMatchupComponents(matchId);
	if (!components) return "matchup components unavailable (skip)";

	try {
		const ch = await client.channels.fetch(channelId);
		if (!ch?.isTextBased() || !("send" in ch)) {
			return "모집 채널 접근 불가 (텍스트 채널 아님)";
		}
		await ch.send({
			flags: MessageFlags.IsComponentsV2,
			components,
		} as Parameters<typeof ch.send>[0]);
		return null;
	} catch (err) {
		const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
		return `auction matchup-card send 실패: ${detail}`;
	}
}

function teamLabel(
	team: Awaited<ReturnType<typeof db.listAuctionTeams>>[number],
	nameById: Map<string, string>,
): string {
	const captain = nameById.get(team.captain_user_id) ?? team.captain_user_id;
	return `팀${team.team_index} · ${team.team_name ?? captain}`;
}

function memberNames(
	members: Awaited<ReturnType<typeof db.listAuctionTeamMembers>>,
	nameById: Map<string, string>,
): string {
	return members.map((m) => nameById.get(m.user_id) ?? m.user_id).join(", ");
}

function roundLabel(round: "SEMI" | "FINAL" | "SINGLE", bracketIndex: number | null): string {
	if (round === "FINAL") return "결승";
	if (round === "SINGLE") return "단일";
	return bracketIndex == null ? "4강" : `4강 #${bracketIndex}`;
}
