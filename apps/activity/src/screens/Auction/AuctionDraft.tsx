// 경매내전 드래프트 화면 — CAPTAIN_PICK / POINT_ALLOC / BIDDING / PLACEMENT 단계.
// 단계별로 inline 컴포넌트 분기. BRACKET_SETUP 이상은 별도 화면 (AuctionBracket).

import { useEffect, useState } from "react";
import { api } from "../../api/rest.js";
import { InlineNotice } from "../../components/DesignPrimitives.js";
import { usePerms } from "../../state/perms.js";
import { AuctionDraftHeader } from "./AuctionDraft/AuctionDraftHeader.js";
import { BiddingPanel } from "./AuctionDraft/BiddingPanel.js";
import { CaptainPicker } from "./AuctionDraft/CaptainPicker.js";
import { PointAllocator } from "./AuctionDraft/PointAllocator.js";
import { RecruitmentStartPanel } from "./AuctionDraft/RecruitmentStartPanel.js";
import { AuctionSteps } from "./AuctionSteps.js";
import type { AuctionRecruitmentDetail } from "./types.js";
import { useAuctionState } from "./useAuctionState.js";

export function AuctionDraft({
	tournamentId,
	recruitmentId,
	onEnterTournament,
	onEnterBracket,
}: {
	tournamentId: number | null;
	recruitmentId: number | null; // tournament 진입 전이면 recruitmentId 만 있음
	onEnterTournament: (id: number) => void;
	onEnterBracket: (id: number) => void;
}) {
	const perms = usePerms();
	const s = useAuctionState(tournamentId);
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [recruitDetail, setRecruitDetail] = useState<AuctionRecruitmentDetail | null>(null);

	// 토너먼트 미생성 — recruitmentId 만 → POST /api/auction-tournaments 으로 진입
	useEffect(() => {
		if (tournamentId !== null || recruitmentId === null) return;
		(async () => {
			try {
				const d = await api<AuctionRecruitmentDetail>(`/auction-recruitments/${recruitmentId}`);
				setRecruitDetail(d);
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			}
		})();
	}, [tournamentId, recruitmentId]);

	// 단계가 BRACKET_SETUP 이상이면 외부에 알림 (parent 가 AuctionBracket 화면으로 라우팅).
	// hook 규칙 — early return 전에 위치. s.detail 이 없으면 status 는 undefined → no-op.
	const tournamentStatus = s.detail?.tournament.status;
	useEffect(() => {
		if (
			tournamentId !== null &&
			(tournamentStatus === "BRACKET_SETUP" ||
				tournamentStatus === "IN_GAME" ||
				tournamentStatus === "COMPLETED")
		) {
			onEnterBracket(tournamentId);
		}
	}, [tournamentId, tournamentStatus, onEnterBracket]);

	const enterTournament = async () => {
		if (recruitmentId === null) return;
		setCreating(true);
		setError(null);
		try {
			const res = await api<{ tournamentId: number }>("/auction-tournaments", {
				method: "POST",
				body: JSON.stringify({ recruitmentId }),
			});
			onEnterTournament(res.tournamentId);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setCreating(false);
		}
	};

	// 토너먼트 진입 전 — 모집 정보 표시 + [경매 시작] 버튼
	if (tournamentId === null) {
		if (!recruitDetail) {
			return <InlineNotice tone="info">경매 모집 로딩 중…</InlineNotice>;
		}
		return (
			<RecruitmentStartPanel
				recruitDetail={recruitDetail}
				error={error}
				canEdit={perms.canEdit}
				creating={creating}
				onEnterTournament={enterTournament}
			/>
		);
	}

	if (s.error) {
		return (
			<InlineNotice
				tone="error"
				action={
					<button type="button" className="btn btn-xs btn-outline" onClick={s.refresh}>
						↻
					</button>
				}
			>
				토너먼트 정보 로딩 실패: {s.error}
			</InlineNotice>
		);
	}
	if (!s.detail) return <InlineNotice tone="info">로딩 중…</InlineNotice>;

	const status = s.detail.tournament.status;

	return (
		<section className="space-y-4">
			<AuctionDraftHeader
				tournamentId={s.detail.tournament.id}
				format={s.detail.tournament.format}
				status={status}
				canEdit={perms.canEdit}
				onRefresh={s.refresh}
				onRevertStage={s.revertStage}
			/>

			<AuctionSteps status={status} />

			{status === "CAPTAIN_PICK" && (
				<CaptainPicker
					tournamentId={s.detail.tournament.id}
					format={s.detail.tournament.format}
					canEdit={perms.canEdit}
					onSet={s.setCaptains}
				/>
			)}
			{status === "POINT_ALLOC" && (
				<PointAllocator
					teams={s.detail.teams}
					canEdit={perms.canEdit}
					onSet={s.setPoints}
					onStartBidding={s.startBidding}
				/>
			)}
			{status === "BIDDING" && (
				<BiddingPanel
					detail={s.detail}
					canEdit={perms.canEdit}
					onDraw={s.draw}
					onCancelDraw={s.cancelDraw}
					onSetBidIntent={s.setBidIntent}
					onFinalizeBid={s.finalizeBid}
					onManualAssign={s.manualAssign}
					onRevertBid={s.revertBid}
					onStartBracket={s.startBracket}
				/>
			)}
		</section>
	);
}
