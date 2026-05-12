// 경매내전 드래프트 화면 — CAPTAIN_PICK / POINT_ALLOC / BIDDING / PLACEMENT 단계.
// 단계별로 inline 컴포넌트 분기. BRACKET_SETUP 이상은 별도 화면 (AuctionBracket).

import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/rest.js";
import { ConfirmButton } from "../../components/ConfirmButton.js";
import { UserAvatar } from "../../components/UserAvatar.js";
import { usePerms } from "../../state/perms.js";
import { useStaleWhileRevalidate } from "../../state/useStaleWhileRevalidate.js";
import { AuctionSteps } from "./AuctionSteps.js";
import { type AuctionCardData, CandidateInfo } from "./CandidateInfo.js";
import type {
	AuctionRecruitmentDetail,
	AuctionTeam,
	AuctionTournamentDetail,
	TournamentStatus,
} from "./types.js";
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
				<div className="card bg-base-200">
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

// ============================================================
// CAPTAIN_PICK — 4명 (20인) 또는 2명 (10인) 선출
// ============================================================
function CaptainPicker({
	tournamentId,
	format,
	canEdit,
	onSet,
}: {
	tournamentId: number;
	format: 10 | 20;
	canEdit: boolean;
	onSet: (userIds: string[]) => Promise<void>;
}) {
	const [recruit, setRecruit] = useState<AuctionRecruitmentDetail | null>(null);
	const [selected, setSelected] = useState<string[]>([]);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const expected = format === 20 ? 4 : 2;

	useEffect(() => {
		(async () => {
			try {
				const d = await api<AuctionRecruitmentDetail>(`/auction-recruitments/${tournamentId}`);
				setRecruit(d);
			} catch (err) {
				setError(err instanceof Error ? err.message : String(err));
			}
		})();
	}, [tournamentId]);

	const toggle = (uid: string) => {
		setSelected((prev) => {
			if (prev.includes(uid)) return prev.filter((u) => u !== uid);
			if (prev.length >= expected) return prev;
			return [...prev, uid];
		});
	};

	const submit = async () => {
		if (selected.length !== expected) return;
		setSubmitting(true);
		setError(null);
		try {
			await onSet(selected);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSubmitting(false);
		}
	};

	if (!recruit) return <div className="alert alert-info">참가자 로딩 중…</div>;

	const remaining = expected - selected.length;

	return (
		<div className="card bg-base-200 shadow">
			<div className="card-body p-5 gap-4">
				<div className="flex items-center justify-between flex-wrap gap-3">
					<div>
						<h3 className="text-lg font-bold">팀장 선출</h3>
						<p className="text-base text-base-content/60">참가자 중에서 팀장이 될 사람을 클릭하세요.</p>
					</div>
					<div className="stats shadow bg-base-100">
						<div className="stat py-2 px-4">
							<div className="stat-title text-sm">선택</div>
							<div className="stat-value text-3xl text-primary tabular-nums">{selected.length}</div>
							<div className="stat-desc text-sm tabular-nums">
								/ {expected} {remaining > 0 ? `(${remaining}명 더)` : "(완료)"}
							</div>
						</div>
					</div>
				</div>
				<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
					{recruit.participants.map((p) => {
						const isSelected = selected.includes(p.userId);
						return (
							<button
								key={p.userId}
								type="button"
								onClick={() => toggle(p.userId)}
								disabled={!canEdit}
								className={`flex items-center gap-2.5 p-2.5 rounded-md border-2 transition ${
									isSelected
										? "border-warning bg-warning/15"
										: "border-base-300 bg-base-100 hover:bg-base-300/40"
								} ${!canEdit ? "cursor-not-allowed opacity-60" : ""}`}
								aria-pressed={isSelected}
							>
								<div className={isSelected ? "ring-2 ring-warning rounded-full" : ""}>
									<UserAvatar discordId={p.userId} displayName={p.displayName} size="sm" />
								</div>
								<div className="flex-1 min-w-0 text-left">
									<div className="font-bold text-base truncate">{p.displayName}</div>
									{isSelected && (
										<div className="text-sm text-warning font-medium flex items-center gap-1">👑 팀장</div>
									)}
								</div>
							</button>
						);
					})}
				</div>
				{error && <div className="alert alert-error">{error}</div>}
				{canEdit && (
					<button
						type="button"
						className="btn btn-primary btn-lg"
						onClick={submit}
						disabled={selected.length !== expected || submitting}
					>
						{submitting ? "진행 중…" : `▶ 팀장 확정 (${selected.length}/${expected})`}
					</button>
				)}
			</div>
		</div>
	);
}

// ============================================================
// POINT_ALLOC — 팀별 초기 포인트 (기본 1000, 조정 가능)
// ============================================================
function PointAllocator({
	teams,
	canEdit,
	onSet,
	onStartBidding,
}: {
	teams: AuctionTeam[];
	canEdit: boolean;
	onSet: (points: Array<{ teamId: number; initialPoints: number }>) => Promise<void>;
	onStartBidding: () => Promise<void>;
}) {
	const [points, setPoints] = useState<Record<number, number>>(() =>
		Object.fromEntries(teams.map((t) => [t.id, t.initialPoints])),
	);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const startBidding = async () => {
		setSubmitting(true);
		setError(null);
		try {
			// 변경된 팀만 저장 → start-bidding 전이
			const changed = teams
				.filter((t) => points[t.id] !== t.initialPoints)
				.map((t) => ({ teamId: t.id, initialPoints: points[t.id]! }));
			if (changed.length > 0) await onSet(changed);
			await onStartBidding();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSubmitting(false);
		}
	};

	const total = teams.reduce((acc, t) => acc + (points[t.id] ?? 0), 0);
	const baseline = teams.length * 1000; // 기준값 (4팀 = 4000)

	return (
		<div className="card bg-base-200 shadow">
			<div className="card-body p-5 gap-4">
				<div className="flex items-center justify-between flex-wrap gap-3">
					<div>
						<h3 className="text-lg font-bold">팀장별 초기 포인트</h3>
						<p className="text-base text-base-content/60">
							기본 1000 — 실력 격차 핸디캡으로 조정 (잘하는 팀장 ↓, 못하는 팀장 ↑).
						</p>
					</div>
					<div className="stats shadow bg-base-100">
						<div className="stat py-2 px-4">
							<div className="stat-title text-sm">총 분배</div>
							<div
								className={`stat-value text-3xl tabular-nums ${total === baseline ? "text-success" : "text-warning"}`}
							>
								{total}
							</div>
							<div className="stat-desc text-sm tabular-nums">
								기준 {baseline}
								{total !== baseline && (
									<span className="ml-1 text-warning">
										({total > baseline ? "+" : ""}
										{total - baseline})
									</span>
								)}
							</div>
						</div>
					</div>
				</div>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
					{teams.map((t) => {
						const p = points[t.id] ?? 0;
						const pct = baseline > 0 ? Math.round((p / 1000) * 50) : 50; // 1000p = 50% (중앙). 2000p = 100%
						return (
							<div key={t.id} className="card bg-base-100">
								<div className="card-body p-4 gap-2.5">
									<div className="flex items-center gap-3">
										<div
											className="radial-progress text-warning tabular-nums"
											style={{ "--value": pct, "--size": "4rem", "--thickness": "5px" } as React.CSSProperties}
											aria-valuenow={pct}
											role="progressbar"
										>
											<span className="text-sm font-bold">{p}p</span>
										</div>
										<UserAvatar discordId={t.captainUserId} displayName={t.captainName} size="sm" />
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-1.5">
												<div className="badge badge-info badge-lg">팀{t.teamIndex}</div>
												<span className="badge badge-warning badge-sm">👑</span>
											</div>
											<div className="font-bold text-base truncate">{t.captainName}</div>
										</div>
									</div>
									<input
										type="number"
										value={p}
										onChange={(e) => setPoints((prev) => ({ ...prev, [t.id]: Number(e.target.value) }))}
										disabled={!canEdit}
										min={0}
										step={50}
										className="input input-bordered w-full text-right tabular-nums text-lg font-bold"
									/>
								</div>
							</div>
						);
					})}
				</div>
				{error && <div className="alert alert-error">{error}</div>}
				{canEdit && (
					<button
						type="button"
						className="btn btn-primary btn-lg"
						onClick={startBidding}
						disabled={submitting}
					>
						{submitting ? "진행 중…" : "▶ 경매 시작"}
					</button>
				)}
			</div>
		</div>
	);
}

// ============================================================
// BIDDING — 🎲 다음 인원 → 입찰 → 낙찰 / 유찰
// ============================================================
function BiddingPanel({
	detail,
	canEdit,
	onDraw,
	onFinalizeBid,
	onManualAssign,
	onRevertBid,
	onStartBracket,
}: {
	detail: AuctionTournamentDetail;
	canEdit: boolean;
	onDraw: () => Promise<{
		userId: string | null;
		displayName: string | null;
		remainingCount: number;
		done: boolean;
	}>;
	onFinalizeBid: (input: { targetUserId: string; teamId: number; points: number }) => Promise<void>;
	onManualAssign: (input: { targetUserId: string; teamId: number }) => Promise<void>;
	onRevertBid: (targetUserId: string) => Promise<void>;
	onStartBracket: () => Promise<void>;
}) {
	const [current, setCurrent] = useState<{ userId: string; displayName: string } | null>(null);
	const [bidPoints, setBidPoints] = useState<Record<number, string>>({});
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const draw = async () => {
		setError(null);
		try {
			const p = await onDraw();
			if (p.done || !p.userId || !p.displayName) {
				// 정상 종료 — 모두 배치 완료
				setCurrent(null);
				return;
			}
			setCurrent({ userId: p.userId, displayName: p.displayName });
			setBidPoints({});
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	};

	const finalize = async (teamId: number) => {
		if (!current) return;
		const points = Number(bidPoints[teamId] ?? 0);
		if (Number.isNaN(points) || points < 0) {
			setError("유효한 포인트 입력 필요");
			return;
		}
		setSubmitting(true);
		setError(null);
		try {
			await onFinalizeBid({ targetUserId: current.userId, teamId, points });
			setCurrent(null);
			setBidPoints({});
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSubmitting(false);
		}
	};

	const manualAssign = async (teamId: number) => {
		if (!current) return;
		setSubmitting(true);
		setError(null);
		try {
			await onManualAssign({ targetUserId: current.userId, teamId });
			setCurrent(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSubmitting(false);
		}
	};

	const allPlaced = detail.teams.every((t) => t.members.length === 5);
	const totalPlaced = detail.teams.reduce((acc, t) => acc + t.members.length, 0);
	const expectedTotal = detail.teams.length * 5;
	const unsoldCount = detail.unsold.length;
	const captainCount = detail.teams.length;
	const recruitPoolSize = expectedTotal; // 정원 = 4팀 × 5명 또는 2팀 × 5명

	// 매물 후보 정보 — hero Avatar 의 imageUrl + CandidateInfo 카드가 같은 데이터 공유.
	const candidateUserId = current?.userId ?? null;
	const candidateFetcher = useCallback(
		() =>
			candidateUserId
				? api<AuctionCardData>(`/users/${candidateUserId}/auction-card`)
				: Promise.reject(new Error("no candidate")),
		[candidateUserId],
	);
	const candidateSwr = useStaleWhileRevalidate<AuctionCardData>(
		candidateUserId ? `auction-card:${candidateUserId}` : null,
		candidateFetcher,
		{ enabled: candidateUserId !== null },
	);
	const candidateRiotIcon = candidateSwr.data?.riotAccounts?.[0]?.profileIconUrl ?? null;

	return (
		<div className="space-y-4">
			{/* 전체 진행 stats — reader 가 한눈에 */}
			<div className="stats stats-horizontal shadow w-full bg-base-200">
				<div className="stat py-3">
					<div className="stat-title text-sm">매물 풀</div>
					<div className="stat-value text-3xl tabular-nums">{recruitPoolSize - captainCount}</div>
					<div className="stat-desc text-sm">팀장 제외</div>
				</div>
				<div className="stat py-3">
					<div className="stat-title text-sm">배치 완료</div>
					<div className="stat-value text-3xl text-success tabular-nums">
						{totalPlaced - captainCount}
					</div>
					<div className="stat-desc text-sm tabular-nums">/ {recruitPoolSize - captainCount}</div>
				</div>
				<div className="stat py-3">
					<div className="stat-title text-sm">잔여 인원</div>
					<div className="stat-value text-3xl text-info tabular-nums">
						{recruitPoolSize - totalPlaced}
					</div>
					<div className="stat-desc text-sm">{current ? "1명 진행 중" : "—"}</div>
				</div>
				<div className="stat py-3">
					<div className="stat-title text-sm">유찰</div>
					<div className="stat-value text-3xl text-warning tabular-nums">{unsoldCount}</div>
					<div className="stat-desc text-sm">재경매 대기</div>
				</div>
			</div>

			{/* 현재 매물 hero */}
			<div className="card bg-base-200 border-l-4 border-primary shadow">
				<div className="card-body p-5 gap-3">
					<div className="flex items-center justify-between flex-wrap gap-2">
						<h3 className="text-lg font-bold flex items-center gap-2">
							📦 현재 매물
							{current && (
								<span
									className="inline-block size-2.5 rounded-full bg-success animate-pulse"
									aria-label="LIVE"
								/>
							)}
						</h3>
						<button
							type="button"
							className="btn btn-primary"
							onClick={draw}
							disabled={!canEdit || allPlaced}
							title={allPlaced ? "모든 인원 배치 완료" : "랜덤 1명 추출"}
						>
							🎲 다음 인원
						</button>
					</div>
					{current ? (
						<div className="flex items-center gap-4 py-2">
							<UserAvatar
								discordId={current.userId}
								displayName={current.displayName}
								size="lg"
								imageUrl={candidateRiotIcon}
							/>
							<div className="flex-1 min-w-0">
								<div className="text-3xl font-bold truncate">{current.displayName}</div>
								<div className="text-sm text-base-content/60">매물 진행 중 · 보이스에서 입찰 협의</div>
							</div>
						</div>
					) : allPlaced ? (
						<div className="text-lg text-success font-medium">
							✅ 모두 배치 완료 — 아래 [▶ 토너먼트 진행] 클릭하세요.
						</div>
					) : (
						<div className="text-base text-base-content/60">🎲 버튼으로 다음 인원 추출</div>
					)}
				</div>
			</div>

			{/* 매물 후보 정보 — 라이엇 (가장 높은 ranked + mastery top 3) | 내전 (laneMmr + 주력 챔프) */}
			{current && <CandidateInfo data={candidateSwr.data} error={candidateSwr.error} />}

			{/* 입찰 패널 */}
			{current && (
				<div className="card bg-base-200 shadow">
					<div className="card-body p-5 gap-3">
						<h3 className="text-lg font-bold">팀별 입찰</h3>
						<div className="space-y-2">
							{detail.teams.map((t) => {
								const full = t.members.length >= 5;
								return (
									<div
										key={t.id}
										className={`flex items-center gap-2 p-2 rounded-md ${full ? "opacity-40" : "bg-base-100/40"}`}
									>
										<div className="badge badge-info badge-lg">팀{t.teamIndex}</div>
										<UserAvatar discordId={t.captainUserId} displayName={t.captainName} size="sm" />
										<div className="flex-1 min-w-0">
											<div className="font-bold text-base truncate flex items-center gap-1">
												<span className="badge badge-warning badge-xs">👑</span>
												{t.captainName}
											</div>
											<div className="text-sm text-base-content/60 tabular-nums">
												잔 {t.currentPoints}p · {t.members.length}/5
											</div>
										</div>
										<input
											type="number"
											placeholder="입찰가"
											value={bidPoints[t.id] ?? ""}
											onChange={(e) => setBidPoints((prev) => ({ ...prev, [t.id]: e.target.value }))}
											disabled={!canEdit || full}
											min={0}
											className="input input-bordered w-24 text-right tabular-nums text-base"
										/>
										<button
											type="button"
											className="btn btn-success"
											onClick={() => finalize(t.id)}
											disabled={!canEdit || submitting || full}
										>
											✓ 낙찰
										</button>
										<button
											type="button"
											className="btn btn-ghost"
											onClick={() => manualAssign(t.id)}
											disabled={!canEdit || submitting || full}
											title="포인트 무관 수동 배치"
										>
											➕ 수동
										</button>
									</div>
								);
							})}
						</div>
						<button type="button" className="btn btn-ghost" onClick={() => setCurrent(null)}>
							유찰 / 다음으로
						</button>
					</div>
				</div>
			)}

			{error && <div className="alert alert-error">{error}</div>}

			{/* 팀 현황 — radial-progress (포인트) + progress (충족률) + avatar 줄 */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				{detail.teams.map((t) => {
					const pointPct =
						t.initialPoints > 0 ? Math.round((t.currentPoints / t.initialPoints) * 100) : 0;
					const fillPct = Math.round((t.members.length / 5) * 100);
					return (
						<div key={t.id} className="card bg-base-200 shadow-sm">
							<div className="card-body p-4 gap-2">
								<div className="flex items-center gap-3">
									<div
										className="radial-progress text-warning tabular-nums"
										style={
											{ "--value": pointPct, "--size": "4rem", "--thickness": "5px" } as React.CSSProperties
										}
										aria-valuenow={pointPct}
										role="progressbar"
									>
										<span className="text-sm font-bold">{t.currentPoints}p</span>
									</div>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-1.5">
											<div className="badge badge-info badge-lg">팀{t.teamIndex}</div>
											<span className="badge badge-warning badge-sm">👑</span>
										</div>
										<div className="font-bold text-base truncate">{t.captainName}</div>
										<div className="text-xs text-base-content/60 tabular-nums">
											초기 {t.initialPoints}p · 사용 {t.initialPoints - t.currentPoints}p
										</div>
									</div>
								</div>

								{/* 팀원 충족률 progress */}
								<div className="space-y-1">
									<div className="flex items-center justify-between text-sm">
										<span className="font-medium">팀원</span>
										<span className="text-base-content/60 tabular-nums">{t.members.length}/5</span>
									</div>
									<progress
										className={`progress ${t.members.length === 5 ? "progress-success" : "progress-info"} w-full`}
										value={fillPct}
										max={100}
									/>
								</div>

								{/* 팀원 avatar 줄 + 이름 */}
								<div className="space-y-1.5">
									{t.members.length === 0 && (
										<div className="text-base text-base-content/40 text-center py-2">_(아직 없음)_</div>
									)}
									{t.members.map((m) => (
										<div key={m.userId} className="flex items-center gap-2 text-base">
											<UserAvatar discordId={m.userId} displayName={m.displayName} size="xs" />
											<span className="flex-1 truncate">{m.displayName}</span>
											{m.acquiredVia === "BID" && m.acquiredAtPoints != null && (
												<span className="text-sm text-base-content/50 tabular-nums">{m.acquiredAtPoints}p</span>
											)}
											{m.acquiredVia === "MANUAL" && <span className="badge badge-xs badge-ghost">수동</span>}
											{canEdit && t.captainUserId !== m.userId && (
												<ConfirmButton
													label="✕"
													onConfirm={() => onRevertBid(m.userId)}
													variant="error"
													className="btn-xs"
												/>
											)}
										</div>
									))}
								</div>
							</div>
						</div>
					);
				})}
			</div>

			{/* 유찰 리스트 — badge 콜렉션 */}
			{detail.unsold.length > 0 && (
				<div className="card bg-base-200 border-l-4 border-warning shadow-sm">
					<div className="card-body p-4 gap-2">
						<h3 className="text-base font-bold">🟡 유찰 ({detail.unsold.length}) — 재경매 대기</h3>
						<div className="flex flex-wrap gap-2">
							{detail.unsold.map((u) => (
								<div key={u.userId} className="badge badge-warning badge-lg gap-1.5 py-3 px-2">
									<UserAvatar discordId={u.userId} displayName={u.displayName} size="xs" />
									<span className="text-sm font-medium">{u.displayName}</span>
								</div>
							))}
						</div>
						<p className="text-sm text-base-content/60">
							🎲 다음 인원 으로 재추출 또는 ➕ 수동 으로 직접 배치하세요.
						</p>
					</div>
				</div>
			)}

			{/* 모두 배치 완료 → 토너먼트 진행 */}
			<div className="card bg-base-200 shadow">
				<div className="card-body p-4 gap-2">
					<div className="flex items-center justify-between flex-wrap gap-2">
						<span className="text-base font-bold">
							배치 현황{" "}
							<span className="tabular-nums text-lg">
								{totalPlaced}/{expectedTotal}
							</span>
						</span>
						{canEdit && (
							<button
								type="button"
								className="btn btn-success btn-lg"
								onClick={onStartBracket}
								disabled={!allPlaced || submitting}
							>
								{allPlaced ? "▶ 토너먼트 진행" : "배치 완료 후"}
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
