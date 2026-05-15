import { useMemo, useState } from "react";
import { api } from "../../../api/rest.js";
import { useStaleWhileRevalidate } from "../../../state/useStaleWhileRevalidate.js";
import type { AuctionMatch, AuctionTournamentDetail } from "../types.js";
import type { MatchDetail } from "./_shared.js";
import { GameHistorySummary } from "./GameHistorySummary.js";
import { GameInputForm } from "./GameInputForm.js";
import { MatchActions } from "./MatchActions.js";
import { MatchHeader } from "./MatchHeader.js";
import { MatchScore } from "./MatchScore.js";
import { MatchTeamRow } from "./MatchTeamRow.js";

export function MatchCard({
	match,
	detail,
	canEdit,
	onTournamentRefresh,
}: {
	match: AuctionMatch;
	detail: AuctionTournamentDetail;
	canEdit: boolean;
	onTournamentRefresh: () => void;
}) {
	const t1 = detail.teams.find((t) => t.id === match.team1Id);
	const t2 = detail.teams.find((t) => t.id === match.team2Id);
	const [expanded, setExpanded] = useState(false);

	const matchFetcher = useMemo(
		() => () => api<MatchDetail>(`/auction-matches/${match.matchId}`),
		[match.matchId],
	);
	const swr = useStaleWhileRevalidate<MatchDetail>(`auction-match:${match.matchId}`, matchFetcher);

	const matchData = swr.data;
	const games = matchData?.games ?? [];
	const completed = matchData?.match.status === "COMPLETED";
	const winningTeam = matchData?.match.winningTeam ?? null;
	const { t1Wins, t2Wins } = useMemo(() => {
		let a = 0;
		let b = 0;
		for (const g of games) {
			if (g.winningTeam === "TEAM_1") a++;
			else if (g.winningTeam === "TEAM_2") b++;
		}
		return { t1Wins: a, t2Wins: b };
	}, [games]);

	const inProgress = !completed && games.length > 0;
	const borderClass = completed
		? "border-2 border-success"
		: inProgress
			? "border-2 border-warning"
			: "border border-base-300";
	const refresh = () => {
		swr.refresh();
		onTournamentRefresh();
	};

	return (
		<div className={`card surface-base shadow ${borderClass}`}>
			<div className="card-body p-4 gap-3">
				<MatchHeader
					match={match}
					inProgress={inProgress}
					completed={completed}
					winningTeam={winningTeam}
					team1={t1}
					team2={t2}
				/>
				<MatchTeamRow team={t1} teamSide="TEAM_1" completed={completed} winningTeam={winningTeam} />
				<MatchScore t1Wins={t1Wins} t2Wins={t2Wins} winningTeam={winningTeam} />
				<MatchTeamRow team={t2} teamSide="TEAM_2" completed={completed} winningTeam={winningTeam} />

				{canEdit && !completed && (
					<MatchActions
						match={match}
						gamesLength={games.length}
						expanded={expanded}
						onExpandedChange={setExpanded}
						onRefresh={refresh}
					/>
				)}
				{expanded && t1 && t2 && (
					<GameInputForm match={match} team1={t1} team2={t2} games={games} onRecorded={swr.refresh} />
				)}
				<GameHistorySummary games={games} />
			</div>
		</div>
	);
}
