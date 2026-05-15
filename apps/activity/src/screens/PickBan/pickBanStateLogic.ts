import {
	emptyGameDraft,
	type GameDraft,
	type PickBanDraft,
	type SeriesDetail,
	type Side,
} from "./types.js";

export function initialPickBanDraft(detail: SeriesDetail): PickBanDraft {
	const teamSize = detail.participants.length / 2;
	return (
		detail.pickbanDraft ?? {
			games: [1, 2, 3].map((gameNumber) => emptyGameDraft(gameNumber, teamSize, teamSize)),
			currentGame: 1,
		}
	);
}

export function completedGameSet(detail: SeriesDetail | null) {
	return new Set(detail?.games.map((game) => game.gameNumber) ?? []);
}

export function isGameTabEnabledByCompleted(n: number, completedGames: Set<number>) {
	return n === 1 || completedGames.has(n - 1);
}

export function currentGameDraft(draft: PickBanDraft | null) {
	return draft ? (draft.games[draft.currentGame - 1] ?? null) : null;
}

export function team2Side(team1Side: Side | null): Side | null {
	if (team1Side === "BLUE") return "RED";
	if (team1Side === "RED") return "BLUE";
	return null;
}

export function winsByTeam(detail: SeriesDetail | null) {
	return {
		t1Wins: detail?.games.filter((game) => game.winningTeam === "TEAM_1").length ?? 0,
		t2Wins: detail?.games.filter((game) => game.winningTeam === "TEAM_2").length ?? 0,
	};
}

export function fearlessUsedChampionIds(detail: SeriesDetail | null, draft: PickBanDraft | null) {
	const set = new Set<number>();
	if (!draft) return set;
	const currentGame = draft.currentGame;

	for (const game of detail?.games ?? []) {
		if (game.gameNumber >= currentGame) continue;
		for (const pick of game.picks) if (pick.championId !== null) set.add(pick.championId);
	}

	for (const gameDraft of draft.games) {
		if (gameDraft.gameNumber >= currentGame) continue;
		for (const team of ["TEAM_1", "TEAM_2"] as const) {
			for (const championId of gameDraft.picks[team]) if (championId !== null) set.add(championId);
		}
	}
	return set;
}

export function setDraftCurrentGame(draft: PickBanDraft | null, gameNumber: number) {
	return draft ? { ...draft, currentGame: gameNumber } : draft;
}

export function setDraftTeam1Side(draft: PickBanDraft | null, side: Side) {
	if (!draft) return draft;
	const games = draft.games.map((game, index) =>
		index === draft.currentGame - 1 ? { ...game, team1Side: side } : game,
	);
	return { ...draft, games };
}

export function replaceCurrentGameDraft(draft: PickBanDraft | null, gameDraft: GameDraft) {
	if (!draft) return draft;
	const games = draft.games.map((current, index) =>
		index === draft.currentGame - 1 ? gameDraft : current,
	);
	return { ...draft, games };
}
