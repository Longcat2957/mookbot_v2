// 경매내전 종료 화면 — 조립 컴포넌트. 세부 UI/데이터 로직은 인접 모듈에 분리.

import { InlineNotice, SectionHeader } from "../../components/DesignPrimitives.js";
import { AuctionResultBracket } from "./AuctionResultBracket.js";
import { AuctionResultGames } from "./AuctionResultGames.js";
import { AuctionResultHero, finalScoreText, runnerUpTeamId } from "./AuctionResultHero.js";
import { AuctionResultTeams } from "./AuctionResultTeams.js";
import { AuctionSteps } from "./AuctionSteps.js";
import { useAuctionResultData } from "./useAuctionResultData.js";

export function AuctionResult({
	tournamentId,
	onBack,
}: {
	tournamentId: number | null;
	onBack: () => void;
}) {
	const { detail, matchDetails, error } = useAuctionResultData(tournamentId);

	if (error) return <InlineNotice tone="error">{error}</InlineNotice>;
	if (!detail) return <InlineNotice tone="info">로딩 중…</InlineNotice>;

	const finalMatch = detail.matches.find((m) => m.round === "FINAL" || m.round === "SINGLE");
	const finalMd = finalMatch ? matchDetails[finalMatch.matchId] : undefined;

	return (
		<section className="space-y-4">
			<header>
				<SectionHeader
					title={<span className="text-2xl">🏆 경매내전 #{detail.tournament.id} 종료</span>}
					actions={
						<button type="button" className="btn btn-ghost" onClick={onBack}>
							← 대시보드
						</button>
					}
				/>
			</header>

			<AuctionSteps status={detail.tournament.status} />
			<AuctionResultHero detail={detail} finalScoreText={finalScoreText(finalMatch, finalMd)} />
			<AuctionResultBracket detail={detail} matchDetails={matchDetails} />
			<AuctionResultTeams detail={detail} runnerUpTeamId={runnerUpTeamId(finalMatch, finalMd)} />
			<AuctionResultGames detail={detail} matchDetails={matchDetails} />
		</section>
	);
}
