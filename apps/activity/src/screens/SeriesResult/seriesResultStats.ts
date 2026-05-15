import type { GameDetail, SeriesDetail } from "./types.js";

export function scoreByTeam(games: GameDetail[]) {
	let team1Wins = 0;
	let team2Wins = 0;
	for (const game of games) {
		if (game.winningTeam === "TEAM_1") team1Wins++;
		else if (game.winningTeam === "TEAM_2") team2Wins++;
	}
	return { team1Wins, team2Wins };
}

export function seriesDateLabel(startedAt: number) {
	const startedDate = new Date(startedAt * 1000);
	return `${startedDate.getMonth() + 1}월 ${startedDate.getDate()}일 ${String(startedDate.getHours()).padStart(2, "0")}:${String(startedDate.getMinutes()).padStart(2, "0")}`;
}

export function seriesMetaLabel(detail: SeriesDetail) {
	const teamSize = detail.participants.length / 2;
	return `시리즈 #${detail.series.id} · ${teamSize}v${teamSize} · ${seriesDateLabel(detail.series.startedAt)}`;
}
