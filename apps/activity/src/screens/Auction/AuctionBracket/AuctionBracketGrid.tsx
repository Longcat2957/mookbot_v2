import type { AuctionTournamentDetail } from "../types.js";
import { FinalSetup } from "./FinalSetup.js";
import { MatchCard } from "./MatchCard.js";

export function AuctionBracketGrid({
	detail,
	canEdit,
	onCreateMatch,
	onTournamentRefresh,
}: {
	detail: AuctionTournamentDetail;
	canEdit: boolean;
	onCreateMatch: (input: {
		round: "SEMI" | "FINAL" | "SINGLE";
		bracketIndex: number | null;
		team1Id: number;
		team2Id: number;
		format: "BO1" | "BO3";
	}) => Promise<{ matchId: number }>;
	onTournamentRefresh: () => void;
}) {
	const matches = detail.matches;
	const semis = matches.filter((m) => m.round === "SEMI");
	const finalOrSingle = matches.find((m) => m.round === "FINAL" || m.round === "SINGLE");

	if (detail.tournament.format !== 20 || (semis.length === 0 && !finalOrSingle)) return null;

	return (
		<div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 lg:items-center">
			<div className="space-y-3">
				<h3 className="text-lg font-bold flex items-center gap-2">
					<span className="badge badge-info badge-lg">4강</span>
					<span className="text-base-content/60 text-sm">SEMI</span>
				</h3>
				{semis.length === 0 ? (
					<div className="text-base text-base-content/40 py-4">_(매치업 구성 대기)_</div>
				) : (
					semis.map((m) => (
						<MatchCard
							key={m.matchId}
							match={m}
							detail={detail}
							canEdit={canEdit}
							onTournamentRefresh={onTournamentRefresh}
						/>
					))
				)}
			</div>

			<div className="flex lg:flex-none lg:items-center text-base-content/40 select-none" aria-hidden>
				<div className="hidden lg:block text-4xl px-2">→</div>
				<div className="lg:hidden w-full flex flex-col items-center gap-1 py-1">
					<div className="text-2xl leading-none">↓</div>
					<div className="text-[10px] uppercase tracking-wider font-semibold">승자 진출</div>
				</div>
			</div>

			<div className="space-y-3">
				<h3 className="text-lg font-bold flex items-center gap-2">
					<span className="badge badge-warning badge-lg">결승</span>
					<span className="text-base-content/60 text-sm">FINAL</span>
				</h3>
				{finalOrSingle ? (
					<MatchCard
						match={finalOrSingle}
						detail={detail}
						canEdit={canEdit}
						onTournamentRefresh={onTournamentRefresh}
					/>
				) : canEdit ? (
					<FinalSetup detail={detail} semis={semis} onCreate={onCreateMatch} />
				) : (
					<div className="text-base text-base-content/40 py-4">_(4강 결과 대기 중)_</div>
				)}
			</div>
		</div>
	);
}

export function SingleMatchList({
	detail,
	canEdit,
	onTournamentRefresh,
}: {
	detail: AuctionTournamentDetail;
	canEdit: boolean;
	onTournamentRefresh: () => void;
}) {
	if (detail.tournament.format === 20 || detail.matches.length === 0) return null;

	return (
		<div className="space-y-2">
			<h3 className="text-lg font-bold flex items-center gap-2">
				<span className="badge badge-warning badge-lg">매치</span>
			</h3>
			{detail.matches.map((m) => (
				<MatchCard
					key={m.matchId}
					match={m}
					detail={detail}
					canEdit={canEdit}
					onTournamentRefresh={onTournamentRefresh}
				/>
			))}
		</div>
	);
}
