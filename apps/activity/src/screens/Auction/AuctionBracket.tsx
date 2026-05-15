// 경매내전 토너먼트 매치 진행 — BRACKET_SETUP / IN_GAME / COMPLETED.

import { useEffect } from "react";
import { InlineNotice } from "../../components/DesignPrimitives.js";
import { usePerms } from "../../state/perms.js";
import { AuctionBracketGrid, SingleMatchList } from "./AuctionBracket/AuctionBracketGrid.js";
import { AuctionBracketHeader } from "./AuctionBracket/AuctionBracketHeader.js";
import { MatchSetup } from "./AuctionBracket/MatchSetup.js";
import { useAuctionState } from "./useAuctionState.js";

export function AuctionBracket({
	tournamentId,
	onCompleted,
}: {
	tournamentId: number | null;
	onCompleted: () => void;
}) {
	const perms = usePerms();
	const s = useAuctionState(tournamentId);

	useEffect(() => {
		if (s.detail?.tournament.status === "COMPLETED") onCompleted();
	}, [s.detail?.tournament.status, onCompleted]);

	if (!tournamentId) return <InlineNotice tone="warning">토너먼트 ID 없음</InlineNotice>;
	if (s.error) return <InlineNotice tone="error">{s.error}</InlineNotice>;
	if (!s.detail) return <InlineNotice tone="info">로딩 중…</InlineNotice>;

	const matches = s.detail.matches;
	const semis = matches.filter((m) => m.round === "SEMI");
	const isSetup =
		s.detail.tournament.status === "BRACKET_SETUP" ||
		(s.detail.tournament.status === "IN_GAME" &&
			((s.detail.tournament.format === 20 && semis.length < 2) ||
				(s.detail.tournament.format === 10 && matches.length === 0)));

	return (
		<section className="space-y-4">
			<AuctionBracketHeader
				tournamentId={s.detail.tournament.id}
				format={s.detail.tournament.format}
				status={s.detail.tournament.status}
				onRefresh={s.refresh}
			/>
			{isSetup && perms.canEdit && <MatchSetup detail={s.detail} onCreate={s.createMatch} />}
			<AuctionBracketGrid
				detail={s.detail}
				canEdit={perms.canEdit}
				onCreateMatch={s.createMatch}
				onTournamentRefresh={s.refresh}
			/>
			<SingleMatchList detail={s.detail} canEdit={perms.canEdit} onTournamentRefresh={s.refresh} />
		</section>
	);
}
