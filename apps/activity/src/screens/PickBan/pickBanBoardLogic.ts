import {
	type ActiveSlot,
	type Champion,
	type ChampionPlay,
	type GameDraft,
	LANE_LABEL,
	LANE_ORDER,
	type SeriesParticipant,
	type Team,
} from "./types.js";

export function cloneDraft(gameDraft: GameDraft): GameDraft {
	return {
		...gameDraft,
		bans: { TEAM_1: [...gameDraft.bans.TEAM_1], TEAM_2: [...gameDraft.bans.TEAM_2] },
		picks: { TEAM_1: [...gameDraft.picks.TEAM_1], TEAM_2: [...gameDraft.picks.TEAM_2] },
	};
}

export function collectUsedIds(gameDraft: GameDraft) {
	const set = new Set<number>();
	for (const arr of [
		gameDraft.bans.TEAM_1,
		gameDraft.bans.TEAM_2,
		gameDraft.picks.TEAM_1,
		gameDraft.picks.TEAM_2,
	]) {
		for (const championId of arr) if (championId !== null) set.add(championId);
	}
	return set;
}

export function filterChampions(champions: Champion[], search: string) {
	if (!search.trim()) return champions;
	const query = search.trim().toLowerCase();
	return champions.filter(
		(champ) =>
			champ.name.toLowerCase().includes(query) ||
			champ.idSlug.toLowerCase().includes(query) ||
			champ.name.replace(/\s+/g, "").toLowerCase().includes(query),
	);
}

export function getActivePlayer(activeSlot: ActiveSlot | null, participants: SeriesParticipant[]) {
	if (!activeSlot || activeSlot.kind !== "pick") return null;
	const lane = LANE_ORDER[activeSlot.idx];
	if (!lane) return null;
	return (
		participants.find(
			(participant) => participant.team === activeSlot.team && participant.role === lane,
		) ?? null
	);
}

export function buildLineup(participants: SeriesParticipant[]) {
	const map = new Map<string, string>();
	for (const participant of participants)
		map.set(`${participant.team}_${participant.role}`, participant.displayName);
	return map;
}

export function getChampionBuckets({
	activePlayer,
	fearlessUsedIds,
	filtered,
	usedIds,
}: {
	activePlayer: SeriesParticipant | null;
	fearlessUsedIds: Set<number>;
	filtered: Champion[];
	usedIds: Set<number>;
}) {
	const filteredIds = new Set(filtered.map((champ) => champ.id));
	const mainsSet = activePlayer
		? new Set(activePlayer.history.topChampions.map((champ) => champ.championId))
		: new Set<number>();

	const mains: ChampionPlay[] = [];
	if (activePlayer) {
		for (const champion of activePlayer.history.topChampions) {
			if (!filteredIds.has(champion.championId)) continue;
			if (fearlessUsedIds.has(champion.championId)) continue;
			if (usedIds.has(champion.championId)) continue;
			mains.push(champion);
		}
	}

	const usable: Champion[] = [];
	const blocked: { champ: Champion; reason: "used" | "fearless" }[] = [];
	for (const champion of filtered) {
		if (fearlessUsedIds.has(champion.id)) {
			blocked.push({ champ: champion, reason: "fearless" });
		} else if (usedIds.has(champion.id)) {
			blocked.push({ champ: champion, reason: "used" });
		} else if (!mainsSet.has(champion.id)) {
			usable.push(champion);
		}
	}
	return { mains, usable, blocked };
}

export function setDraftSlot(
	gameDraft: GameDraft,
	activeSlot: ActiveSlot,
	championId: number | null,
) {
	const next = cloneDraft(gameDraft);
	const arr = activeSlot.kind === "ban" ? next.bans[activeSlot.team] : next.picks[activeSlot.team];
	arr[activeSlot.idx] = championId;
	return next;
}

export function applyBulkChanges(
	gameDraft: GameDraft,
	changes: { team: Team; kind: "ban" | "pick"; championIds: (number | null)[] }[],
) {
	const next = cloneDraft(gameDraft);
	for (const { team, kind, championIds } of changes) {
		const arr = kind === "ban" ? next.bans[team] : next.picks[team];
		for (let index = 0; index < championIds.length && index < arr.length; index++) {
			const championId = championIds[index];
			if (championId !== null && championId !== undefined) arr[index] = championId;
		}
	}
	return next;
}

export function getActiveSlotInfo(activeSlot: ActiveSlot | null, lineup: Map<string, string>) {
	if (!activeSlot) return null;
	const teamLabel = activeSlot.team === "TEAM_1" ? "1팀" : "2팀";
	const kindLabel = activeSlot.kind === "ban" ? "밴" : "픽";
	if (activeSlot.kind === "pick") {
		const lane = LANE_ORDER[activeSlot.idx];
		if (lane) {
			const player = lineup.get(`${activeSlot.team}_${lane}`);
			return `🎯 ${teamLabel} ${kindLabel} · ${LANE_LABEL[lane] ?? lane}${player ? ` (${player})` : ""}`;
		}
	}
	return `🎯 ${teamLabel} ${kindLabel} #${activeSlot.idx + 1}`;
}
