import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../../api/rest.js";
import { ConfirmButton } from "../../../components/ConfirmButton.js";
import { UserAvatar } from "../../../components/UserAvatar.js";
import { useStaleWhileRevalidate } from "../../../state/useStaleWhileRevalidate.js";
import {
	type AuctionCardData,
	CandidateMookSection,
	CandidateRiotSection,
} from "../CandidateInfo.js";
import type { AuctionTournamentDetail } from "../types.js";

// ============================================================
// BIDDING — 🎲 다음 인원 → 입찰 → 낙찰 / 유찰
// v0.14: "현재 매물" + 입찰 의도가 서버 state — 모든 화면 실시간 sync.
// 입찰가 input onChange 가 debounced setBidIntent → 다른 운영자/관전자에게 broadcast.
// ============================================================

const BID_INTENT_DEBOUNCE_MS = 300;

export function BiddingPanel({
	detail,
	canEdit,
	onDraw,
	onCancelDraw,
	onSetBidIntent,
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
	onCancelDraw: () => Promise<void>;
	onSetBidIntent: (input: { teamId: number; points: number | null }) => Promise<void>;
	onFinalizeBid: (input: { targetUserId: string; teamId: number; points: number }) => Promise<void>;
	onManualAssign: (input: { targetUserId: string; teamId: number }) => Promise<void>;
	onRevertBid: (targetUserId: string) => Promise<void>;
	onStartBracket: () => Promise<void>;
}) {
	const currentBidTarget = detail.tournament.currentBidTarget;
	const candidateUserId = currentBidTarget?.userId ?? null;

	const [bidPoints, setBidPoints] = useState<Record<number, string>>({});
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// 매물 바뀔 때 input field 동기화 — 서버 intents 로 초기화.
	// 같은 매물 진행 중에는 본인 typing 을 끊지 않게 sync 생략.
	const lastSyncedTargetRef = useRef<string | null>(null);
	useEffect(() => {
		const uid = currentBidTarget?.userId ?? null;
		if (uid === lastSyncedTargetRef.current) return;
		lastSyncedTargetRef.current = uid;
		if (!currentBidTarget) {
			setBidPoints({});
			return;
		}
		const initial: Record<number, string> = {};
		for (const i of currentBidTarget.intents) initial[i.teamId] = String(i.points);
		setBidPoints(initial);
	}, [currentBidTarget]);

	// 입찰 의도 debounced — 사용자 typing 마다 API call 안 하도록.
	const intentTimerRef = useRef<number | null>(null);
	const queueBidIntent = useCallback(
		(teamId: number, raw: string) => {
			if (intentTimerRef.current) window.clearTimeout(intentTimerRef.current);
			intentTimerRef.current = window.setTimeout(() => {
				intentTimerRef.current = null;
				const trimmed = raw.trim();
				if (trimmed === "") {
					void onSetBidIntent({ teamId, points: null });
					return;
				}
				const points = Number(trimmed);
				if (!Number.isFinite(points) || points < 0) return;
				void onSetBidIntent({ teamId, points });
			}, BID_INTENT_DEBOUNCE_MS);
		},
		[onSetBidIntent],
	);

	useEffect(() => {
		return () => {
			if (intentTimerRef.current) window.clearTimeout(intentTimerRef.current);
		};
	}, []);

	const handleBidInput = (teamId: number, value: string) => {
		setBidPoints((prev) => ({ ...prev, [teamId]: value }));
		queueBidIntent(teamId, value);
	};

	const draw = async () => {
		setError(null);
		try {
			await onDraw();
			// 서버가 current_bid_target_user_id set 후 broadcast — useAuctionState 가 refresh.
			// 본인 화면은 origin-suppress 라 별도 효과 없지만 onDraw 자체가 finalizeBid 도 호출 안 함 → swr 강제 갱신은 useAuctionState 에서.
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	};

	const cancelDraw = async () => {
		setError(null);
		try {
			await onCancelDraw();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		}
	};

	const finalize = async (teamId: number) => {
		if (!currentBidTarget) return;
		const points = Number(bidPoints[teamId] ?? 0);
		if (Number.isNaN(points) || points < 0) {
			setError("유효한 포인트 입력 필요");
			return;
		}
		setSubmitting(true);
		setError(null);
		try {
			await onFinalizeBid({ targetUserId: currentBidTarget.userId, teamId, points });
			// 서버가 currentBidTarget 을 null 로 set + broadcast — UI 가 자동 갱신.
			// bidPoints reset 도 currentBidTarget 변화로 useEffect 가 처리.
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSubmitting(false);
		}
	};

	const manualAssign = async (teamId: number) => {
		if (!currentBidTarget) return;
		setSubmitting(true);
		setError(null);
		try {
			await onManualAssign({ targetUserId: currentBidTarget.userId, teamId });
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

	// 매물 후보 정보 — hero Avatar 의 imageUrl + 라이엇/내전 섹션이 같은 데이터 공유.
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

	// teamId → 다른 사람들이 입력 중인 입찰가 (read-only 표시용 — 본인 input 옆에 작은 글씨로).
	const intentByTeam = new Map<number, number>();
	for (const i of currentBidTarget?.intents ?? []) intentByTeam.set(i.teamId, i.points);

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
					<div className="stat-desc text-sm">{currentBidTarget ? "1명 진행 중" : "—"}</div>
				</div>
				<div className="stat py-3">
					<div className="stat-title text-sm">유찰</div>
					<div className="stat-value text-3xl text-warning tabular-nums">{unsoldCount}</div>
					<div className="stat-desc text-sm">재경매 대기</div>
				</div>
			</div>

			{/* 현재 매물 + 라이엇 + 내전 — 한 카드 안에서 separator 로 분리 (시각 일관성). */}
			<div className="card surface-base border-l-4 border-primary shadow">
				<div className="card-body p-5 gap-3">
					<div className="flex items-center justify-between flex-wrap gap-2">
						<h3 className="text-lg font-bold flex items-center gap-2">
							📦 현재 매물
							{currentBidTarget && (
								<span
									className="inline-block size-2.5 rounded-full bg-success animate-pulse"
									aria-label="LIVE"
								/>
							)}
						</h3>
						<div className="flex items-center gap-2">
							{currentBidTarget && canEdit && (
								<button
									type="button"
									className="btn btn-ghost btn-sm"
									onClick={cancelDraw}
									disabled={submitting}
									title="매물 취소 — 배치 없이 닫고 다음으로"
								>
									유찰 / 다음으로
								</button>
							)}
							{canEdit && (
								<button
									type="button"
									className="btn btn-primary"
									onClick={draw}
									disabled={allPlaced || currentBidTarget !== null}
									title={
										allPlaced
											? "모든 인원 배치 완료"
											: currentBidTarget
												? "현재 매물 처리 후"
												: "랜덤 1명 추출"
									}
								>
									🎲 다음 인원
								</button>
							)}
						</div>
					</div>
					{currentBidTarget ? (
						<>
							<div className="flex items-center gap-4 py-2">
								<UserAvatar
									discordId={currentBidTarget.userId}
									displayName={currentBidTarget.displayName}
									size="lg"
									imageUrl={candidateRiotIcon ?? currentBidTarget.profileIconUrl}
								/>
								<div className="flex-1 min-w-0">
									<div className="text-3xl font-bold truncate">{currentBidTarget.displayName}</div>
									<div className="text-sm text-base-content/60">매물 진행 중 · 보이스에서 입찰 협의</div>
								</div>
							</div>

							<div className="divider my-0 text-xs text-base-content/60">🎮 라이엇 연동 (솔로랭크)</div>
							{/* key — 매물 교체 시 candidateSwr 의 이전 데이터 플리커 차단. */}
							<CandidateRiotSection
								key={`riot-${currentBidTarget.userId}`}
								data={candidateSwr.data}
								error={candidateSwr.error}
							/>

							<div className="divider my-0 text-xs text-base-content/60">⚔️ 내전 기록</div>
							<CandidateMookSection
								key={`mook-${currentBidTarget.userId}`}
								data={candidateSwr.data}
							/>
						</>
					) : allPlaced ? (
						<div className="text-lg text-success font-medium">
							✅ 모두 배치 완료 — 아래 [▶ 토너먼트 진행] 클릭하세요.
						</div>
					) : (
						<div className="text-base text-base-content/60">
							🎲 버튼으로 다음 인원 추출 (다른 화면 함께 sync)
						</div>
					)}
				</div>
			</div>

			{error && <div className="alert alert-error">{error}</div>}

			{/* 팀 카드 — 헤더 + 입찰 입력 (current 매물 진행 중) + 팀원 리스트.
			    20인=4팀 → 2x2, 10인=2팀 → 1x2 grid. 입찰 패널 분리 X (시각 통합). */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				{detail.teams.map((t) => {
					const pointPct =
						t.initialPoints > 0 ? Math.round((t.currentPoints / t.initialPoints) * 100) : 0;
					const fillPct = Math.round((t.members.length / 5) * 100);
					const full = t.members.length >= 5;
					const isBidding = currentBidTarget !== null;
					const sharedIntent = intentByTeam.get(t.id);
					const localValue = bidPoints[t.id] ?? "";
					// 다른 사람들에게 broadcast 된 intent — 본인 input 값과 다르면 "타 화면 입력" 표시.
					const sharedDiffersFromLocal =
						sharedIntent !== undefined && localValue.trim() !== String(sharedIntent);
					return (
						<div
							key={t.id}
							className={`card surface-base shadow-sm transition ${
								isBidding && !full ? "ring-2 ring-primary/40" : ""
							}`}
						>
							<div className="card-body p-4 gap-2">
								<div className="flex items-center gap-3">
									<div
										className="radial-progress text-warning tabular-nums"
										style={
											{
												"--value": pointPct,
												"--size": "4rem",
												"--thickness": "5px",
											} as React.CSSProperties
										}
										aria-valuenow={pointPct}
										role="progressbar"
										aria-label={`팀${t.teamIndex} 잔여 포인트 ${t.currentPoints} / ${t.initialPoints}`}
									>
										<span className="text-sm font-bold">{t.currentPoints}p</span>
									</div>
									<UserAvatar
										discordId={t.captainUserId}
										displayName={t.captainName}
										imageUrl={t.captainProfileIconUrl}
										size="sm"
									/>
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

								<div className="space-y-1">
									<div className="flex items-center justify-between text-sm">
										<span className="font-medium">팀원</span>
										<span className="text-base-content/60 tabular-nums">{t.members.length}/5</span>
									</div>
									<progress
										className={`progress ${
											t.members.length === 5 ? "progress-success" : "progress-info"
										} w-full`}
										value={fillPct}
										max={100}
									/>
								</div>

								{/* 입찰 입력 / 의도 표시 — currentBidTarget 가 있을 때만. full 이면 비활성. */}
								{isBidding &&
									(full ? (
										<div className="text-xs text-base-content/40 text-center surface-quiet-soft rounded-md py-1.5">
											팀원 모집 완료
										</div>
									) : canEdit ? (
										<div className="flex items-center gap-1.5 surface-quiet-soft rounded-md p-1.5">
											<input
												type="number"
												placeholder="입찰가"
												value={localValue}
												onChange={(e) => handleBidInput(t.id, e.target.value)}
												min={0}
												className="input input-bordered input-sm flex-1 text-right tabular-nums"
												aria-label={`팀${t.teamIndex} 입찰가`}
											/>
											<button
												type="button"
												className="btn btn-success btn-sm"
												onClick={() => finalize(t.id)}
												disabled={submitting}
											>
												✓ 낙찰
											</button>
											<button
												type="button"
												className="btn btn-ghost btn-sm"
												onClick={() => manualAssign(t.id)}
												disabled={submitting}
												title="포인트 무관 수동 배치"
											>
												➕
											</button>
										</div>
									) : sharedIntent !== undefined ? (
										// 관전자 (또는 canEdit=false) 가 보는 read-only 진행 중 입찰가.
										<div className="flex items-center gap-2 surface-quiet-soft rounded-md p-1.5 text-sm">
											<span className="text-base-content/60">현재 입찰</span>
											<span className="ml-auto font-bold tabular-nums text-warning">
												{sharedIntent}p
											</span>
										</div>
									) : (
										<div className="text-xs text-base-content/40 text-center surface-quiet-soft rounded-md py-1.5">
											입찰 대기
										</div>
									))}

								{/* 다른 화면의 입찰 의도 표시 — 본인 입력과 다른 경우만 (UX noise 회피). */}
								{isBidding && canEdit && sharedDiffersFromLocal && (
									<div className="text-[11px] text-base-content/60 flex items-center gap-1.5 px-1">
										<span className="inline-block size-1.5 rounded-full bg-info animate-pulse" aria-hidden />
										다른 화면 입력:{" "}
										<span className="font-bold tabular-nums text-info">{sharedIntent}p</span>
									</div>
								)}

								<div className="space-y-1.5">
									{t.members.length === 0 && (
										<div className="text-base text-base-content/40 text-center py-2">_(아직 없음)_</div>
									)}
									{t.members.map((m) => (
										<div key={m.userId} className="flex items-center gap-2 text-base">
											<UserAvatar
												discordId={m.userId}
												displayName={m.displayName}
												imageUrl={m.profileIconUrl}
												size="xs"
											/>
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
				<div className="card surface-base border-l-4 border-warning shadow-sm">
					<div className="card-body p-4 gap-2">
						<h3 className="text-base font-bold">🟡 유찰 ({detail.unsold.length}) — 재경매 대기</h3>
						<div className="flex flex-wrap gap-2">
							{detail.unsold.map((u) => (
								<div key={u.userId} className="badge badge-warning badge-lg gap-1.5 py-3 px-2">
									<UserAvatar
										discordId={u.userId}
										displayName={u.displayName}
										imageUrl={u.profileIconUrl}
										size="xs"
									/>
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
			<div className="card surface-base shadow">
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
