// 경매내전 토너먼트 매치 진행 — BRACKET_SETUP / IN_GAME / COMPLETED.
// 매치 생성 + BO1/BO3 선택 + 라인 자유 픽 + 게임 결과 입력 + 자동 결승.

import { useEffect } from "react";
import { usePerms } from "../../state/perms.js";
import { FinalSetup } from "./AuctionBracket/FinalSetup.js";
import { MatchCard } from "./AuctionBracket/MatchCard.js";
import { MatchSetup } from "./AuctionBracket/MatchSetup.js";
import { AuctionSteps } from "./AuctionSteps.js";
import type { TournamentStatus } from "./types.js";
import { useAuctionState } from "./useAuctionState.js";

function statusLabel(s: TournamentStatus): string {
	return {
		CAPTAIN_PICK: "팀장 선출",
		POINT_ALLOC: "포인트 배정",
		BIDDING: "경매 진행",
		PLACEMENT: "배치 완료",
		BRACKET_SETUP: "매치업 구성",
		IN_GAME: "매치 진행 중",
		COMPLETED: "종료",
		CANCELLED: "취소",
	}[s];
}

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

	if (!tournamentId) return <div className="alert alert-warning">토너먼트 ID 없음</div>;
	if (s.error) return <div className="alert alert-error">{s.error}</div>;
	if (!s.detail) return <div className="alert alert-info">로딩 중…</div>;

	const matches = s.detail.matches;
	const semis = matches.filter((m) => m.round === "SEMI");
	const finalOrSingle = matches.find((m) => m.round === "FINAL" || m.round === "SINGLE");
	// 4강 매치업 동시 진행 가능 — 첫 SEMI 만들고 IN_GAME 으로 전환된 후에도
	// 두 번째 SEMI 만들기 위해 setup 노출 유지. 20인 = SEMI 2개 다 만들어질 때까지,
	// 10인 = SINGLE 1개 만들어질 때까지.
	const isSetup =
		s.detail.tournament.status === "BRACKET_SETUP" ||
		(s.detail.tournament.status === "IN_GAME" &&
			((s.detail.tournament.format === 20 && semis.length < 2) ||
				(s.detail.tournament.format === 10 && matches.length === 0)));

	const is20 = s.detail.tournament.format === 20;

	return (
		<section className="space-y-4">
			<header className="flex items-start justify-between flex-wrap gap-3">
				<div className="space-y-1">
					<h2 className="text-2xl font-bold">🎟️ 경매내전 #{s.detail.tournament.id} 토너먼트</h2>
					<p className="text-base text-base-content/70">
						{s.detail.tournament.format}인 · 현재 단계:{" "}
						<strong>{statusLabel(s.detail.tournament.status)}</strong>
					</p>
				</div>
				<div className="flex items-center gap-1">
					<button type="button" className="btn btn-ghost btn-sm" onClick={s.refresh}>
						↻
					</button>
					{/* 토너먼트 강제 취소는 안전을 위해 봇 슬래시 (/경매내전강제삭제) 로 일원화.
					    Activity 에서는 단계 되돌리기 (revertStage) 만 가능 — AuctionDraft 의 [↩ 단계] dropdown 참조. */}
				</div>
			</header>

			<AuctionSteps status={s.detail.tournament.status} />

			{/* BRACKET_SETUP — 운영자가 매치업 구성 */}
			{isSetup && perms.canEdit && <MatchSetup detail={s.detail} onCreate={s.createMatch} />}

			{/* 20인 — 4강 + 결승.
			    lg+: 1fr / → / 1fr 의 가로 bracket.
			    lg 미만: 4강 → ↓ connector → 결승 의 세로 흐름. */}
			{is20 && (semis.length > 0 || finalOrSingle) && (
				<div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 lg:items-center">
					{/* 4강 */}
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
									detail={s.detail!}
									canEdit={perms.canEdit}
									onTournamentRefresh={s.refresh}
								/>
							))
						)}
					</div>

					{/* 연결 표시 — 데스크탑은 가로 화살표, 모바일은 세로 흐름 라벨.
					    aria-hidden — 의미는 인접 결승 헤더로 충분 (스크린리더 중복 회피). */}
					<div
						className="flex lg:flex-none lg:items-center text-base-content/40 select-none"
						aria-hidden
					>
						<div className="hidden lg:block text-4xl px-2">→</div>
						<div className="lg:hidden w-full flex flex-col items-center gap-1 py-1">
							<div className="text-2xl leading-none">↓</div>
							<div className="text-[10px] uppercase tracking-wider font-semibold">승자 진출</div>
						</div>
					</div>

					{/* 결승 */}
					<div className="space-y-3">
						<h3 className="text-lg font-bold flex items-center gap-2">
							<span className="badge badge-warning badge-lg">결승</span>
							<span className="text-base-content/60 text-sm">FINAL</span>
						</h3>
						{finalOrSingle ? (
							<MatchCard
								match={finalOrSingle}
								detail={s.detail}
								canEdit={perms.canEdit}
								onTournamentRefresh={s.refresh}
							/>
						) : perms.canEdit ? (
							<FinalSetup detail={s.detail} semis={semis} onCreate={s.createMatch} />
						) : (
							<div className="text-base text-base-content/40 py-4">_(4강 결과 대기 중)_</div>
						)}
					</div>
				</div>
			)}

			{/* 10인 — 단일 매치 */}
			{!is20 && matches.length > 0 && (
				<div className="space-y-2">
					<h3 className="text-lg font-bold flex items-center gap-2">
						<span className="badge badge-warning badge-lg">매치</span>
					</h3>
					{matches.map((m) => (
						<MatchCard
							key={m.matchId}
							match={m}
							detail={s.detail!}
							canEdit={perms.canEdit}
							onTournamentRefresh={s.refresh}
						/>
					))}
				</div>
			)}
		</section>
	);
}
