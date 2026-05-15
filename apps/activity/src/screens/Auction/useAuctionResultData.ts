import { useEffect, useState } from "react";
import { api } from "../../api/rest.js";
import type { AuctionMatchDetailResponse, MatchSeriesDetail } from "./resultTypes.js";
import type { AuctionTournamentDetail } from "./types.js";

export function useAuctionResultData(tournamentId: number | null) {
	const [detail, setDetail] = useState<AuctionTournamentDetail | null>(null);
	const [matchDetails, setMatchDetails] = useState<Record<number, MatchSeriesDetail>>({});
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (tournamentId === null) return;
		let cancelled = false;
		(async () => {
			try {
				setError(null);
				const d = await api<AuctionTournamentDetail>(`/auction-tournaments/${tournamentId}`);
				if (cancelled) return;
				setDetail(d);
				const matches = await Promise.all(
					d.matches.map((m) =>
						api<AuctionMatchDetailResponse>(`/auction-matches/${m.matchId}`).then((r) => ({
							matchId: m.matchId,
							series: {
								id: r.match.id,
								winningTeam: r.match.winningTeam,
								games: r.games,
							} as MatchSeriesDetail,
						})),
					),
				);
				if (cancelled) return;
				const map: Record<number, MatchSeriesDetail> = {};
				for (const m of matches) map[m.matchId] = m.series;
				setMatchDetails(map);
			} catch (err) {
				if (!cancelled) setError(err instanceof Error ? err.message : String(err));
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [tournamentId]);

	return { detail, matchDetails, error };
}
