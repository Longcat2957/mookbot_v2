import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/rest.js";
import { wsClient } from "../api/ws.js";
import { EmptyState } from "../components/EmptyState.js";
import { type LineupParticipant, LineupPreview } from "../components/LineupPreview.js";
import { MeHero } from "../components/MeHero.js";
import { showToast } from "../components/Toaster.js";
import { WelcomeCard } from "../components/WelcomeCard.js";
import { useStaleWhileRevalidate } from "../state/useStaleWhileRevalidate.js";

interface Recruitment {
	id: number;
	targetCount: number;
	status: string;
	createdBy: string;
	createdAt: number;
}

interface SeriesItem {
	id: number;
	seasonId: number;
	status: string;
	startedAt: number;
	participants: LineupParticipant[];
}

interface CompletedSeries {
	id: number;
	seasonId: number;
	winningTeam: "TEAM_1" | "TEAM_2" | null;
	startedAt: number;
	endedAt: number | null;
	wins: { team1: number; team2: number };
	participants: LineupParticipant[];
}

export function RecruitmentList({
	onSelectRecruitment,
	onSelectSeries,
	onSelectCompletedSeries,
	onOpenLeaderboard,
	onOpenMinigame,
	onOpenHelp,
	onOpenMyProfile,
}: {
	onSelectRecruitment: (id: number) => void;
	onSelectSeries: (id: number) => void;
	onSelectCompletedSeries: (id: number) => void;
	onOpenLeaderboard: () => void;
	onOpenMinigame: () => void;
	onOpenHelp: () => void;
	onOpenMyProfile: () => void;
}) {
	const PAGE_SIZE = 8;
	const [page, setPage] = useState(1);

	// pending (recruitments + 진행중) 과 completed (paginated) 분리 SWR.
	// completed 만 page 변경 시 재 fetch — pending 은 동일 키 유지.
	const fetchPending = useCallback(async () => {
		const [r, s] = await Promise.all([
			api<{ recruitments: Recruitment[] }>("/recruitments"),
			api<{ series: SeriesItem[] }>("/series"),
		]);
		return { recruitments: r.recruitments, series: s.series };
	}, []);
	const fetchCompleted = useCallback(async () => {
		const offset = (page - 1) * PAGE_SIZE;
		const c = await api<{ series: CompletedSeries[]; total: number }>(
			`/series/completed?limit=${PAGE_SIZE}&offset=${offset}`,
		);
		return { items: c.series, total: c.total };
	}, [page]);

	const pendingSwr = useStaleWhileRevalidate("dashboard", fetchPending, { debounceMs: 150 });
	const completedSwr = useStaleWhileRevalidate(`dashboard:completed:p${page}`, fetchCompleted, {
		debounceMs: 150,
	});

	const recruitments = pendingSwr.data?.recruitments ?? null;
	const series = pendingSwr.data?.series ?? null;
	const completed = completedSwr.data?.items ?? null;
	const completedTotal = completedSwr.data?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(completedTotal / PAGE_SIZE));
	const error = pendingSwr.error ?? completedSwr.error;

	// 시리즈 삭제 등으로 page 가 totalPages 를 초과한 경우 자동 클램프.
	useEffect(() => {
		if (completedSwr.data && page > totalPages) setPage(totalPages);
	}, [completedSwr.data, page, totalPages]);

	// dashboard topic 구독 — 다른 사용자 변경 시 양 SWR 모두 background refresh.
	useEffect(() => {
		return wsClient.subscribe("dashboard", () => {
			pendingSwr.refresh();
			completedSwr.refresh();
			showToast("대시보드가 업데이트되었습니다");
		});
	}, [pendingSwr, completedSwr]);

	const header = (
		<div className="flex items-end justify-between gap-3 flex-wrap">
			<div>
				<h1 className="text-2xl font-bold tracking-tight">대시보드</h1>
				<p className="text-sm text-base-content/60">
					처리 대기 카드 클릭 → 엔트리 작성 또는 픽/밴 입력
				</p>
			</div>
			<button
				type="button"
				className="btn btn-circle btn-ghost btn-sm"
				onClick={() => {
					pendingSwr.refresh();
					completedSwr.refresh();
				}}
				title="새로고침"
				aria-label="새로고침"
			>
				↻
			</button>
		</div>
	);

	// 처리 대기 통합 정렬 — 모집 + 진행중, 가장 오래된 것 위로 (방치 방지)
	const pending = useMemo(() => {
		if (recruitments === null || series === null) return [];
		type PendingItem =
			| { kind: "rec"; data: Recruitment; sortKey: number }
			| { kind: "series"; data: SeriesItem; sortKey: number };
		const items: PendingItem[] = [];
		for (const r of recruitments) items.push({ kind: "rec", data: r, sortKey: r.createdAt });
		for (const s of series) items.push({ kind: "series", data: s, sortKey: s.startedAt });
		items.sort((a, b) => a.sortKey - b.sortKey);
		return items;
	}, [recruitments, series]);

	if (error) {
		return (
			<section className="space-y-4">
				{header}
				<div className="alert alert-error">
					<span>목록을 불러오지 못했습니다: {error}</span>
				</div>
			</section>
		);
	}

	const isLoading = recruitments === null || series === null || completed === null;

	return (
		<section className="space-y-6">
			{header}

			{/* 본인 요약 카드 — op.gg 스타일 (라인별 MMR + 시즌 W/L) */}
			<MeHero onSelectMe={onOpenMyProfile} />

			{/* 신규 사용자 안내 — 한 번만 표시 (localStorage dismiss) */}
			<WelcomeCard
				onOpenLeaderboard={onOpenLeaderboard}
				onOpenMinigame={onOpenMinigame}
				onOpenHelp={onOpenHelp}
			/>

			{/* 처리 대기 — 모집 + 진행중 통합 (시간순 — 오래된 것 위) */}
			<div className="space-y-2">
				<div className="flex items-baseline justify-between flex-wrap gap-2">
					<h2 className="text-lg font-bold flex items-baseline gap-2">
						처리 대기
						{!isLoading && pending.length > 0 && (
							<span className="text-xs font-normal text-base-content/60">
								{recruitments.length} 엔트리 · {series.length} 진행 중
							</span>
						)}
					</h2>
				</div>
				{isLoading ? (
					<SkeletonGrid />
				) : pending.length === 0 ? (
					<EmptyState
						title="처리할 항목이 없습니다"
						description="새 모집을 시작하거나, 엔트리를 제출해 시리즈를 만들면 여기에 표시됩니다."
						tone="warning"
						steps={[
							<>
								봇 채널에서 <code className="kbd kbd-sm">/내전모집</code> 입력
							</>,
							<>
								정원 도달 시 모집 메시지의{" "}
								<span className="badge badge-success badge-sm">▶ 엔트리 수정 시작</span> 버튼 클릭
							</>,
							<>이곳에서 카드 클릭 → 엔트리 수정 → 픽/밴 진행</>,
						]}
					/>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						{pending.map((item) =>
							item.kind === "rec" ? (
								<RecruitmentCard
									key={`r-${item.data.id}`}
									rec={item.data}
									onClick={() => onSelectRecruitment(item.data.id)}
								/>
							) : (
								<SeriesCard
									key={`s-${item.data.id}`}
									series={item.data}
									onClick={() => onSelectSeries(item.data.id)}
								/>
							),
						)}
					</div>
				)}
			</div>

			<div className="divider my-0 opacity-50" />

			{/* 지난 내전 — 기본 펼침 collapse */}
			<details className="space-y-2" open>
				<summary className="cursor-pointer text-lg font-bold list-none flex items-center gap-2 select-none">
					<span className="text-base-content/40 text-sm">▼</span>
					지난 내전
					{!isLoading && completedTotal > 0 && (
						<span className="text-xs font-normal text-base-content/50 ml-1">({completedTotal})</span>
					)}
				</summary>
				<div className="pt-2 space-y-3">
					{isLoading ? (
						<SkeletonGrid />
					) : completed.length === 0 ? (
						<EmptyState
							title="아직 종료된 내전이 없습니다"
							description="시리즈가 종료되면 이곳에서 게임별 픽/밴 결과를 다시 볼 수 있습니다."
						/>
					) : (
						<>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
								{completed.map((s) => (
									<CompletedSeriesCard
										key={s.id}
										series={s}
										onClick={() => onSelectCompletedSeries(s.id)}
									/>
								))}
							</div>
							{totalPages > 1 && (
								<div className="flex justify-center pt-1">
									<div className="join">
										<button
											type="button"
											className="join-item btn btn-sm"
											onClick={() => setPage((p) => Math.max(1, p - 1))}
											disabled={page === 1}
											aria-label="이전 페이지"
										>
											«
										</button>
										<span className="join-item btn btn-sm btn-ghost no-animation pointer-events-none tabular-nums">
											{page} / {totalPages}
										</span>
										<button
											type="button"
											className="join-item btn btn-sm"
											onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
											disabled={page >= totalPages}
											aria-label="다음 페이지"
										>
											»
										</button>
									</div>
								</div>
							)}
						</>
					)}
				</div>
			</details>
		</section>
	);
}

function CompletedSeriesCard({
	series,
	onClick,
}: {
	series: CompletedSeries;
	onClick: () => void;
}) {
	const winner =
		series.winningTeam === "TEAM_1" ? "1팀" : series.winningTeam === "TEAM_2" ? "2팀" : "—";
	const winnerColor =
		series.winningTeam === "TEAM_1"
			? "text-info"
			: series.winningTeam === "TEAM_2"
				? "text-error"
				: "";
	return (
		<button type="button" onClick={onClick} className="card-action card-status-completed">
			<div className="card-body py-4 gap-2">
				<div className="flex items-center justify-between">
					<h3 className="card-title text-base">시리즈 #{series.id}</h3>
					<span className="badge badge-success badge-sm">종료</span>
				</div>
				<div className="flex items-center gap-3 text-sm">
					<span className="tabular-nums font-bold">
						<span className="text-info">{series.wins.team1}</span>
						<span className="opacity-30 mx-1">:</span>
						<span className="text-error">{series.wins.team2}</span>
					</span>
					<span className={`font-medium ${winnerColor}`}>{winner} 승</span>
					<span className="text-base-content/60 text-xs ml-auto">
						{formatAgo(series.endedAt ?? series.startedAt)}
					</span>
				</div>
				{series.participants.length > 0 && (
					<div className="surface-quiet rounded p-2 mt-1">
						<LineupPreview participants={series.participants} compact />
					</div>
				)}
			</div>
		</button>
	);
}

function RecruitmentCard({ rec, onClick }: { rec: Recruitment; onClick: () => void }) {
	const teamSize = rec.targetCount / 2;
	return (
		<button type="button" onClick={onClick} className="card-action card-status-waiting">
			<div className="card-body py-4 gap-1">
				<div className="flex items-center justify-between">
					<h3 className="card-title text-base">
						{teamSize}v{teamSize} 내전
					</h3>
					<span className="badge badge-warning badge-sm">엔트리 대기</span>
				</div>
				<div className="text-sm text-base-content/70">
					모집 #{rec.id} · {formatAgo(rec.createdAt)}
				</div>
				<div className="text-xs text-base-content/50 mt-1">→ 클릭하여 엔트리 수정 화면으로</div>
			</div>
		</button>
	);
}

function SeriesCard({ series, onClick }: { series: SeriesItem; onClick: () => void }) {
	return (
		<button type="button" onClick={onClick} className="card-action card-status-progress">
			<div className="card-body py-4 gap-2">
				<div className="flex items-center justify-between">
					<h3 className="card-title text-base flex items-center gap-2">
						시리즈 #{series.id}
						<span className="inline-grid *:[grid-area:1/1]">
							<span className="status status-success animate-ping" aria-hidden="true" />
							<span className="status status-success" aria-label="라이브" />
						</span>
					</h3>
					<span className="badge badge-info badge-sm">{series.status}</span>
				</div>
				<div className="text-xs text-base-content/60">
					시즌 {series.seasonId} · 시작 {formatAgo(series.startedAt)}
				</div>
				{series.participants.length > 0 && (
					<div className="surface-quiet rounded p-2">
						<LineupPreview participants={series.participants} compact />
					</div>
				)}
				<div className="text-xs text-base-content/50">→ 클릭하여 픽/밴 이어가기</div>
			</div>
		</button>
	);
}

function SkeletonGrid() {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
			{[0, 1].map((i) => (
				<div key={i} className="card surface-base shadow-sm">
					<div className="card-body py-4 gap-3">
						<div className="skeleton h-6 w-32" />
						<div className="skeleton h-4 w-48" />
					</div>
				</div>
			))}
		</div>
	);
}

function formatAgo(unixSec: number): string {
	const diff = Math.floor(Date.now() / 1000) - unixSec;
	if (diff < 60) return "방금 전";
	if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
	if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
	return `${Math.floor(diff / 86400)}일 전`;
}
