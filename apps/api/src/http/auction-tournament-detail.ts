import { datadragon, db } from "@mookbot/core";
import { rewriteDD } from "./_helpers.js";
import { getBidIntents } from "./auction-bid-intents.js";

export async function buildAuctionTournamentDetail(id: number) {
	const t = await db.getAuctionTournament(id);
	if (!t) return null;

	const rec = await db.getAuctionRecruitment(id);
	const recruitParts = rec ? await db.listAuctionRecruitmentParticipants(id) : [];
	const teams = await db.listAuctionTeams(id);
	const allMembers = await db.listAuctionTeamMembersByTournament(id);
	const matches = await db.listAuctionMatches(id);
	const bids = await db.listAuctionBids(id);

	const userIds = new Set<string>();
	for (const p of recruitParts) userIds.add(p.user_id);
	for (const m of allMembers) userIds.add(m.user_id);
	for (const team of teams) userIds.add(team.captain_user_id);
	if (t.current_bid_target_user_id) userIds.add(t.current_bid_target_user_id);
	const userIdList = [...userIds];
	const [users, mains] = await Promise.all([
		userIdList.length > 0 ? db.listUsers(userIdList) : Promise.resolve([]),
		userIdList.length > 0 ? db.listMainRiotAccounts(userIdList) : Promise.resolve([]),
	]);
	const nameById = new Map(users.map((u) => [u.discord_id, u.display_name]));
	const iconByUser = new Map(
		mains.flatMap((m) =>
			m.profile_icon_id == null
				? []
				: [[m.user_id, rewriteDD(datadragon.getProfileIconUrl(m.profile_icon_id))] as const],
		),
	);

	const membersByTeam = new Map<number, typeof allMembers>();
	for (const m of allMembers) {
		const members = membersByTeam.get(m.team_id) ?? [];
		members.push(m);
		membersByTeam.set(m.team_id, members);
	}

	const placedUserIds = new Set(allMembers.map((m) => m.user_id));
	const unsold = recruitParts
		.filter((p) => !placedUserIds.has(p.user_id))
		.map((p) => ({
			userId: p.user_id,
			displayName: nameById.get(p.user_id) ?? p.user_id,
			profileIconUrl: iconByUser.get(p.user_id) ?? null,
		}));

	const currentBidTargetUserId = t.current_bid_target_user_id;
	const currentBidTarget = currentBidTargetUserId
		? {
				userId: currentBidTargetUserId,
				displayName: nameById.get(currentBidTargetUserId) ?? currentBidTargetUserId,
				profileIconUrl: iconByUser.get(currentBidTargetUserId) ?? null,
				intents: await getBidIntents(id),
			}
		: null;

	return {
		tournament: {
			id: t.id,
			format: t.format,
			status: t.status,
			championTeamId: t.champion_team_id,
			startedAt: t.started_at,
			endedAt: t.ended_at,
			currentBidTarget,
		},
		teams: teams.map((team) => ({
			id: team.id,
			teamIndex: team.team_index,
			captainUserId: team.captain_user_id,
			captainName: nameById.get(team.captain_user_id) ?? team.captain_user_id,
			captainProfileIconUrl: iconByUser.get(team.captain_user_id) ?? null,
			teamName: team.team_name,
			initialPoints: team.initial_points,
			currentPoints: team.current_points,
			members: (membersByTeam.get(team.id) ?? []).map((m) => ({
				userId: m.user_id,
				displayName: nameById.get(m.user_id) ?? m.user_id,
				profileIconUrl: iconByUser.get(m.user_id) ?? null,
				acquiredVia: m.acquired_via,
				acquiredAtPoints: m.acquired_at_points,
			})),
		})),
		unsold,
		matches: matches.map((m) => ({
			matchId: m.id,
			round: m.round,
			bracketIndex: m.bracket_index,
			team1Id: m.team1_id,
			team2Id: m.team2_id,
			format: m.format,
			status: m.status,
			winningTeam: m.winning_team,
		})),
		bids: bids.map((b) => ({
			id: b.id,
			targetUserId: b.target_user_id,
			teamId: b.team_id,
			points: b.points,
			isFinal: b.is_final === 1,
			createdAt: b.created_at,
		})),
	};
}
