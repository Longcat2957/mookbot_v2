import { useCallback, useState } from "react";
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
// ============================================================
export function BiddingPanel({
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

	// 매물 후보 정보 — hero Avatar 의 imageUrl + 라이엇/내전 섹션이 같은 데이터 공유.
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

			{/* 현재 매물 + 라이엇 + 내전 — 한 카드 안에서 separator 로 분리 (시각 일관성). */}
			<div className="card surface-base border-l-4 border-primary shadow">
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
						<div className="flex items-center gap-2">
							{current && (
								<button
									type="button"
									className="btn btn-ghost btn-sm"
									onClick={() => setCurrent(null)}
									disabled={!canEdit || submitting}
								>
									유찰 / 다음으로
								</button>
							)}
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
					</div>
					{current ? (
						<>
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

							<div className="divider my-0 text-xs text-base-content/60">🎮 라이엇 연동 (솔로랭크)</div>
							{/* key={current.userId} — draw() 직후 candidateSwr 가 이전 데이터 잠시 반환하는
							    플리커 (다음 매물 이름 + 직전 매물 라이엇 정보) 차단. 매물 바뀌면 강제 리셋. */}
							<CandidateRiotSection
								key={`riot-${current.userId}`}
								data={candidateSwr.data}
								error={candidateSwr.error}
							/>

							<div className="divider my-0 text-xs text-base-content/60">⚔️ 내전 기록</div>
							<CandidateMookSection key={`mook-${current.userId}`} data={candidateSwr.data} />
						</>
					) : allPlaced ? (
						<div className="text-lg text-success font-medium">
							✅ 모두 배치 완료 — 아래 [▶ 토너먼트 진행] 클릭하세요.
						</div>
					) : (
						<div className="text-base text-base-content/60">🎲 버튼으로 다음 인원 추출</div>
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
					const isBidding = current !== null;
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

								{/* 입찰 입력 — current 매물이 있을 때만 보임. full 이면 비활성. */}
								{isBidding &&
									(full ? (
										<div className="text-xs text-base-content/40 text-center bg-base-100/30 rounded-md py-1.5">
											팀원 모집 완료
										</div>
									) : (
										<div className="flex items-center gap-1.5 surface-quiet-soft rounded-md p-1.5">
											<input
												type="number"
												placeholder="입찰가"
												value={bidPoints[t.id] ?? ""}
												onChange={(e) => setBidPoints((prev) => ({ ...prev, [t.id]: e.target.value }))}
												disabled={!canEdit}
												min={0}
												className="input input-bordered input-sm flex-1 text-right tabular-nums"
											/>
											<button
												type="button"
												className="btn btn-success btn-sm"
												onClick={() => finalize(t.id)}
												disabled={!canEdit || submitting}
											>
												✓ 낙찰
											</button>
											<button
												type="button"
												className="btn btn-ghost btn-sm"
												onClick={() => manualAssign(t.id)}
												disabled={!canEdit || submitting}
												title="포인트 무관 수동 배치"
											>
												➕
											</button>
										</div>
									))}

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
