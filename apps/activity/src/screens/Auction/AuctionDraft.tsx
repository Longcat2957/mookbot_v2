// 경매내전 드래프트 화면 — CAPTAIN_PICK / POINT_ALLOC / BIDDING / PLACEMENT 단계.
// 단계별로 inline 컴포넌트 분기. BRACKET_SETUP 이상은 별도 화면 (AuctionBracket).

import { useEffect, useState } from "react";
import { api } from "../../api/rest.js";
import { ConfirmButton } from "../../components/ConfirmButton.js";
import { usePerms } from "../../state/perms.js";
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
			<section className="space-y-3">
				<h2 className="text-xl font-bold">🎟️ 경매내전 모집 #{recruitDetail.recruitment.id}</h2>
				<div className="text-sm text-base-content/70">
					{recruitDetail.recruitment.targetCount}인 · 참가자 {recruitDetail.participants.length}/
					{recruitDetail.recruitment.targetCount}
				</div>
				<div className="card bg-base-200">
					<div className="card-body p-4 gap-1.5">
						<h3 className="font-bold">참가자</h3>
						{recruitDetail.participants.map((p, i) => (
							<div key={p.userId} className="text-sm">
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
						className="btn btn-primary"
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
		<section className="space-y-3">
			<header className="flex items-center justify-between flex-wrap gap-2">
				<div>
					<h2 className="text-xl font-bold">🎟️ 경매내전 #{s.detail.tournament.id}</h2>
					<p className="text-xs text-base-content/70">
						{s.detail.tournament.format}인 · 단계: <strong>{statusLabel(status)}</strong>
					</p>
				</div>
				<button type="button" className="btn btn-ghost btn-sm" onClick={s.refresh}>
					↻
				</button>
			</header>

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

	return (
		<div className="card bg-base-200">
			<div className="card-body p-4 gap-2">
				<h3 className="font-bold">
					팀장 {expected}명 선출 ({selected.length}/{expected})
				</h3>
				<p className="text-xs text-base-content/60">참가자 중에서 팀장이 될 사람을 클릭하세요.</p>
				<div className="grid grid-cols-2 md:grid-cols-3 gap-2">
					{recruit.participants.map((p) => {
						const isSelected = selected.includes(p.userId);
						return (
							<button
								key={p.userId}
								type="button"
								onClick={() => toggle(p.userId)}
								disabled={!canEdit}
								className={`btn btn-sm justify-start ${isSelected ? "btn-primary" : "btn-outline"}`}
							>
								{isSelected && <span className="badge badge-xs">팀장</span>}
								<span className="truncate">{p.displayName}</span>
							</button>
						);
					})}
				</div>
				{error && <div className="alert alert-error alert-sm">{error}</div>}
				{canEdit && (
					<button
						type="button"
						className="btn btn-primary"
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

	return (
		<div className="card bg-base-200">
			<div className="card-body p-4 gap-3">
				<h3 className="font-bold">팀장별 초기 포인트</h3>
				<p className="text-xs text-base-content/60">
					기본 1000 — 실력 격차 핸디캡으로 조정 가능 (잘하는 팀장 ↓, 못하는 팀장 ↑).
				</p>
				<div className="space-y-2">
					{teams.map((t) => (
						<div key={t.id} className="flex items-center gap-3">
							<div className="badge badge-info badge-lg">팀{t.teamIndex}</div>
							<span className="flex-1 font-medium truncate">{t.captainName}</span>
							<input
								type="number"
								value={points[t.id]}
								onChange={(e) => setPoints((prev) => ({ ...prev, [t.id]: Number(e.target.value) }))}
								disabled={!canEdit}
								min={0}
								className="input input-bordered input-sm w-24 text-right tabular-nums"
							/>
						</div>
					))}
				</div>
				{error && <div className="alert alert-error alert-sm">{error}</div>}
				{canEdit && (
					<button type="button" className="btn btn-primary" onClick={startBidding} disabled={submitting}>
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
	onDraw: () => Promise<{ userId: string; displayName: string; remainingCount: number }>;
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

	return (
		<div className="space-y-3">
			{/* 현재 매물 */}
			<div className="card bg-base-200 border-l-4 border-primary">
				<div className="card-body p-4 gap-2">
					<div className="flex items-center justify-between">
						<h3 className="font-bold">📦 현재 매물</h3>
						<button type="button" className="btn btn-sm btn-primary" onClick={draw} disabled={!canEdit}>
							🎲 다음 인원
						</button>
					</div>
					{current ? (
						<div className="text-lg font-bold">{current.displayName}</div>
					) : (
						<div className="text-sm text-base-content/60">🎲 버튼으로 다음 인원 추출</div>
					)}
				</div>
			</div>

			{/* 입찰 패널 */}
			{current && (
				<div className="card bg-base-200">
					<div className="card-body p-4 gap-2">
						<h3 className="font-bold">팀별 입찰 — {current.displayName}</h3>
						<div className="space-y-2">
							{detail.teams.map((t) => (
								<div key={t.id} className="flex items-center gap-2">
									<div className="badge badge-info badge-lg">팀{t.teamIndex}</div>
									<span className="flex-1 truncate text-sm">
										{t.captainName} <span className="text-base-content/50">잔 {t.currentPoints}p</span>
									</span>
									<input
										type="number"
										placeholder="입찰가"
										value={bidPoints[t.id] ?? ""}
										onChange={(e) => setBidPoints((prev) => ({ ...prev, [t.id]: e.target.value }))}
										disabled={!canEdit || t.members.length >= 5}
										min={0}
										className="input input-bordered input-sm w-20 text-right tabular-nums"
									/>
									<button
										type="button"
										className="btn btn-sm btn-success"
										onClick={() => finalize(t.id)}
										disabled={!canEdit || submitting || t.members.length >= 5}
									>
										✓ 낙찰
									</button>
									<button
										type="button"
										className="btn btn-sm btn-ghost"
										onClick={() => manualAssign(t.id)}
										disabled={!canEdit || submitting || t.members.length >= 5}
										title="포인트 무관 수동 배치"
									>
										➕ 수동
									</button>
								</div>
							))}
						</div>
						<button type="button" className="btn btn-sm btn-ghost" onClick={() => setCurrent(null)}>
							유찰 / 다음으로
						</button>
					</div>
				</div>
			)}

			{error && <div className="alert alert-error">{error}</div>}

			{/* 팀 현황 */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				{detail.teams.map((t) => (
					<div key={t.id} className="card bg-base-200">
						<div className="card-body p-3 gap-1.5">
							<div className="flex items-center gap-2">
								<div className="badge badge-info">팀{t.teamIndex}</div>
								<span className="font-bold truncate">{t.captainName}</span>
								<span className="ml-auto text-xs text-base-content/60 tabular-nums">
									{t.currentPoints}/{t.initialPoints}p
								</span>
							</div>
							<div className="space-y-0.5">
								{t.members.length === 0 && (
									<div className="text-sm text-base-content/40">_(아직 없음)_</div>
								)}
								{t.members.map((m) => (
									<div key={m.userId} className="flex items-center gap-2 text-sm">
										<span className="flex-1 truncate">{m.displayName}</span>
										{m.acquiredVia === "BID" && m.acquiredAtPoints != null && (
											<span className="text-xs text-base-content/50 tabular-nums">{m.acquiredAtPoints}p</span>
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
							<div className="text-xs text-base-content/50">{t.members.length}/5</div>
						</div>
					</div>
				))}
			</div>

			{/* 유찰 리스트 */}
			{detail.unsold.length > 0 && (
				<div className="card bg-base-200 border-l-4 border-warning">
					<div className="card-body p-3 gap-1.5">
						<h3 className="font-bold">유찰 리스트 ({detail.unsold.length})</h3>
						<div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
							{detail.unsold.map((u) => (
								<div key={u.userId} className="text-sm py-1 px-2 bg-base-100 rounded">
									{u.displayName}
								</div>
							))}
						</div>
						<p className="text-xs text-base-content/60">
							🎲 다음 인원 으로 재추출 또는 ➕ 수동 으로 직접 배치하세요.
						</p>
					</div>
				</div>
			)}

			{/* 모두 배치 완료 → 토너먼트 진행 */}
			<div className="card bg-base-200">
				<div className="card-body p-3 gap-2">
					<div className="flex items-center justify-between">
						<span className="font-bold">
							배치 현황:{" "}
							<span className="tabular-nums">
								{totalPlaced}/{expectedTotal}
							</span>
						</span>
						{canEdit && (
							<button
								type="button"
								className="btn btn-sm btn-success"
								onClick={onStartBracket}
								disabled={!allPlaced || submitting}
							>
								{allPlaced ? "▶ 토너먼트 진행" : `배치 완료 후`}
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
