import { getRiotClient } from "./client.js";
import type { MatchDto, MatchParticipantDto } from "./types.js";

export type RiotLane = "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY";
export type MookMainPosition = "TOP" | "JUNGLE" | "MID" | "BOTTOM" | "SUPPORT" | "FLEX";

const SOLO_QUEUE_ID = 420;
const POSITION_TO_ROLE: Record<RiotLane, "TOP" | "JUNGLE" | "MID" | "BOTTOM" | "SUPPORT"> = {
	TOP: "TOP",
	JUNGLE: "JUNGLE",
	MIDDLE: "MID",
	BOTTOM: "BOTTOM",
	UTILITY: "SUPPORT",
};

/**
 * Get recent match IDs for a player.
 */
export async function getMatchIds(puuid: string, count: number = 20): Promise<string[]> {
	return getRiotClient().getMatchIds(puuid, count);
}

/**
 * Get full match details by match ID.
 */
export async function getMatch(matchId: string): Promise<MatchDto> {
	return getRiotClient().getMatch(matchId);
}

/**
 * Get recent matches with full details.
 * Fetches match IDs first, then retrieves each match.
 */
export async function getRecentMatches(puuid: string, count: number = 5): Promise<MatchDto[]> {
	const matchIds = await getMatchIds(puuid, count);
	const matches: MatchDto[] = [];
	for (const id of matchIds) {
		const match = await getMatch(id);
		matches.push(match);
	}
	return matches;
}

/**
 * Find a participant in a match by puuid.
 */
export function findParticipant(match: MatchDto, puuid: string): MatchParticipantDto | undefined {
	return match.info.participants.find((p) => p.puuid === puuid);
}

/**
 * Format a participant's KDA.
 */
export function formatKDA(kills: number, deaths: number, assists: number): string {
	const kda = deaths === 0 ? "Perfect" : ((kills + assists) / deaths).toFixed(2);
	return `${kills}/${deaths}/${assists} (${kda})`;
}

export async function inferMainPositionFromSoloRanked(
	puuid: string,
	count: number = 50,
): Promise<{
	role: MookMainPosition | null;
	sampleSize: number;
	scores: Record<string, number>;
}> {
	const matchIds = await getRiotClient().getMatchIds(
		puuid,
		Math.min(Math.max(count, 1), 50),
		"ASIA",
		{
			queue: SOLO_QUEUE_ID,
		},
	);
	const scores: Record<string, number> = {};
	let sampleSize = 0;
	for (const id of matchIds) {
		const match = await getMatch(id);
		const participant = match.info.participants.find((p) => p.puuid === puuid);
		if (!participant) continue;
		const raw = participant.teamPosition || participant.individualPosition;
		if (!isRiotLane(raw)) continue;
		const role = POSITION_TO_ROLE[raw];
		sampleSize += 1;
		scores[role] = (scores[role] ?? 0) + (participant.win ? 3 : 1);
	}
	const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
	const topScore = entries[0]?.[1] ?? 0;
	const totalScore = entries.reduce((sum, [, score]) => sum + score, 0);
	const topRoles = entries.filter(([, score]) => score === topScore).map(([role]) => role);
	const topRatio = totalScore > 0 ? topScore / totalScore : 0;
	const role =
		topScore === 0 || sampleSize === 0
			? null
			: topRoles.length > 1 || topRatio < 0.6
				? "FLEX"
				: topRoles[0];
	return {
		role: isMookRole(role) ? role : null,
		sampleSize,
		scores,
	};
}

function isRiotLane(value: string): value is RiotLane {
	return (
		value === "TOP" ||
		value === "JUNGLE" ||
		value === "MIDDLE" ||
		value === "BOTTOM" ||
		value === "UTILITY"
	);
}

function isMookRole(value: string | undefined | null): value is MookMainPosition {
	return (
		value === "TOP" ||
		value === "JUNGLE" ||
		value === "MID" ||
		value === "BOTTOM" ||
		value === "SUPPORT" ||
		value === "FLEX"
	);
}
