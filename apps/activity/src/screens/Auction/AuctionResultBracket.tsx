import { ResultMatchCard } from "./ResultMatchCard.js";
import type { MatchSeriesDetail } from "./resultTypes.js";
import type { AuctionTournamentDetail } from "./types.js";

export function AuctionResultBracket({
	detail,
	matchDetails,
}: {
	detail: AuctionTournamentDetail;
	matchDetails: Record<number, MatchSeriesDetail>;
}) {
	const finalMatch = detail.matches.find((m) => m.round === "FINAL" || m.round === "SINGLE");
	const semis = detail.matches.filter((m) => m.round === "SEMI");

	if (detail.tournament.format === 20 && semis.length > 0 && finalMatch) {
		return (
			<div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-3 lg:items-center">
				<div className="space-y-3">
					<h3 className="text-lg font-bold flex items-center gap-2">
						<span className="badge badge-info badge-lg">4강</span>
					</h3>
					{semis.map((m) => (
						<ResultMatchCard key={m.matchId} match={m} detail={detail} md={matchDetails[m.matchId]} />
					))}
				</div>
				<div className="flex lg:flex-none lg:items-center text-base-content/40 select-none" aria-hidden>
					<div className="hidden lg:block text-4xl px-2">→</div>
					<div className="lg:hidden w-full flex flex-col items-center gap-1 py-1">
						<div className="text-2xl leading-none">↓</div>
						<div className="text-[10px] uppercase tracking-wider font-semibold">승자 진출</div>
					</div>
				</div>
				<div>
					<h3 className="text-lg font-bold flex items-center gap-2 mb-3">
						<span className="badge badge-warning badge-lg">결승</span>
					</h3>
					<ResultMatchCard match={finalMatch} detail={detail} md={matchDetails[finalMatch.matchId]} />
				</div>
			</div>
		);
	}

	if (detail.tournament.format !== 20 && finalMatch) {
		return (
			<div className="space-y-2">
				<h3 className="text-lg font-bold flex items-center gap-2">
					<span className="badge badge-warning badge-lg">매치</span>
				</h3>
				<ResultMatchCard match={finalMatch} detail={detail} md={matchDetails[finalMatch.matchId]} />
			</div>
		);
	}

	return null;
}
