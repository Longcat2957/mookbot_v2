// 경매내전 드래프트 화면 — CAPTAIN_PICK / POINT_ALLOC / BIDDING / PLACEMENT 단계.
// 단계별로 inline 컴포넌트 분기. BRACKET_SETUP 이상은 별도 화면 (AuctionBracket).

import { useEffect, useState } from "react";
import { api } from "../../api/rest.js";
import { ConfirmButton } from "../../components/ConfirmButton.js";
import { usePerms } from "../../state/perms.js";
import { BiddingPanel } from "./AuctionDraft/BiddingPanel.js";
import { CaptainPicker } from "./AuctionDraft/CaptainPicker.js";
import { PointAllocator } from "./AuctionDraft/PointAllocator.js";
import { AuctionSteps } from "./AuctionSteps.js";
import type { AuctionRecruitmentDetail, TournamentStatus } from "./types.js";
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
			return <div className="alert alert-info">경매 모집 로딩 중…</div>;
		}
		return (
			<section className="space-y-4">
				<header className="space-y-3">
					<h2 className="text-2xl font-bold">🎟️ 경매내전 모집 #{recruitDetail.recruitment.id}</h2>
					<p className="text-base text-base-content/70">
						{recruitDetail.recruitment.targetCount}인 · 참가자{" "}
						<span className="font-bold tabular-nums">
							{recruitDetail.participants.length}/{recruitDetail.recruitment.targetCount}
						</span>
					</p>
					<AuctionSteps status="RECRUITMENT" />
				</header>
				<div className="card surface-base">
					<div className="card-body p-5 gap-2">
						<h3 className="text-base font-bold">참가자</h3>
						{recruitDetail.participants.map((p, i) => (
							<div key={p.userId} className="text-base">
								<span className="text-base-content/50 tabular-nums">{i + 1}.</span>{" "}
								<strong>{p.displayName}</strong>
							</div>
						))}
					</div>
				</div>
				{error && <div className="alert alert-error">{error}</div>}
				{perms.canEdit && (
					<button
						type="button"
						className="btn btn-primary btn-lg"
						onClick={enterTournament}
						disabled={
							creating || recruitDetail.participants.length !== recruitDetail.recruitment.targetCount
						}
					>
						{creating ? "진입 중…" : "▶ 경매 시작"}
					</button>
				)}
			</section>
		);
	}

	if (s.error) {
		return (
			<div className="alert alert-error">
				토너먼트 정보 로딩 실패: {s.error}{" "}
				<button type="button" className="btn btn-xs btn-outline ml-2" onClick={s.refresh}>
					↻
				</button>
			</div>
		);
	}
	if (!s.detail) return <div className="alert alert-info">로딩 중…</div>;

	const status = s.detail.tournament.status;

	return (
		<section className="space-y-4">
			<header className="flex items-start justify-between flex-wrap gap-3">
				<div className="space-y-1">
					<h2 className="text-2xl font-bold">🎟️ 경매내전 #{s.detail.tournament.id}</h2>
					<p className="text-base text-base-content/70">
						{s.detail.tournament.format}인 · 현재 단계: <strong>{statusLabel(status)}</strong>
					</p>
				</div>
				<div className="flex items-center gap-1">
					<button type="button" className="btn btn-ghost btn-sm" onClick={s.refresh}>
						↻
					</button>
					{perms.canEdit && (status === "POINT_ALLOC" || status === "BIDDING") && (
						<div className="dropdown dropdown-end">
							<div tabIndex={0} role="button" className="btn btn-ghost btn-sm" aria-label="단계 되돌리기">
								↩ 단계
							</div>
							<div
								tabIndex={0}
								className="dropdown-content bg-base-100 rounded-box z-30 w-60 p-2 shadow-lg border border-base-300 space-y-1"
							>
								<div className="text-xs uppercase tracking-wide text-base-content/60 px-2 pt-1 pb-0.5">
									단계 되돌리기 (위험)
								</div>
								<ConfirmButton
									label="↩ 팀장 재선출 (CAPTAIN_PICK)"
									onConfirm={() => s.revertStage("CAPTAIN_PICK")}
									variant="warning"
									className="w-full justify-start btn-sm"
								/>
								{status === "BIDDING" && (
									<ConfirmButton
										label="↩ 포인트 재배정 (POINT_ALLOC)"
										onConfirm={() => s.revertStage("POINT_ALLOC")}
										variant="warning"
										className="w-full justify-start btn-sm"
									/>
								)}
								<div className="text-[10px] text-base-content/50 px-2 pt-1 leading-snug">
									팀장 재선출: 모든 팀/팀원/입찰 초기화.
									{status === "BIDDING" && " 포인트 재배정: 입찰/팀원(팀장 외) 초기화 + 포인트 reset."}
								</div>
							</div>
						</div>
					)}
				</div>
			</header>

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

function statusLabel(s: TournamentStatus): string {
	return {
		CAPTAIN_PICK: "팀장 선출",
		POINT_ALLOC: "포인트 배정",
		BIDDING: "경매 진행",
		PLACEMENT: "배치 완료",
		BRACKET_SETUP: "토너먼트 설정",
		IN_GAME: "매치 진행",
		COMPLETED: "종료",
		CANCELLED: "취소",
	}[s];
}
