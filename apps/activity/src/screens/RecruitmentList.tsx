import { useEffect, useState } from "react";
import { api } from "../api/rest.js";
import { wsClient } from "../api/ws.js";
import { LineupPreview, type LineupParticipant } from "../components/LineupPreview.js";
import { EmptyState } from "../components/EmptyState.js";

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
}: {
	onSelectRecruitment: (id: number) => void;
	onSelectSeries: (id: number) => void;
	onSelectCompletedSeries: (id: number) => void;
}) {
	const [recruitments, setRecruitments] = useState<Recruitment[] | null>(null);
	const [series, setSeries] = useState<SeriesItem[] | null>(null);
	const [completed, setCompleted] = useState<CompletedSeries[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [reloadKey, setReloadKey] = useState(0);

	useEffect(() => {
		let cancelled = false;
		setError(null);
		setRecruitments(null);
		setSeries(null);
		setCompleted(null);

		Promise.all([
			api<{ recruitments: Recruitment[] }>("/recruitments"),
			api<{ series: SeriesItem[] }>("/series"),
			api<{ series: CompletedSeries[] }>("/series/completed?limit=20"),
		])
			.then(([r, s, c]) => {
				if (cancelled) return;
				setRecruitments(r.recruitments);
				setSeries(s.series);
				setCompleted(c.series);
			})
			.catch((err: unknown) => {
				if (!cancelled) setError(err instanceof Error ? err.message : String(err));
			});

		return () => {
			cancelled = true;
		};
	}, [reloadKey]);

	const refresh = () => setReloadKey((k) => k + 1);

	// dashboard topic 구독 — 서버측 write (시리즈 생성/종료/취소 등) 시 자동 reload
	useEffect(() => {
		return wsClient.subscribe("dashboard", refresh);
	}, []);

	const header = (
		<div className="flex items-start justify-between">
			<div>
				<h1 className="text-2xl font-bold">대시보드</h1>
				<p className="text-sm text-base-content/70">
					마감된 모집은 엔트리 작성, 진행중인 내전은 이어서 픽/밴 입력.
				</p>
			</div>
			<button type="button" className="btn btn-sm btn-ghost" onClick={refresh} title="새로고침">
				↻
			</button>
		</div>
	);

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

			{/* 엔트리 수정 대기 */}
			<div className="space-y-2">
				<h2 className="text-lg font-bold">엔트리 수정 대기</h2>
				{isLoading ? (
					<SkeletonGrid />
				) : recruitments.length === 0 ? (
					<EmptyState
						title="엔트리 수정 대기 중인 모집이 없습니다"
						description="봇 채널에서 모집을 만들면 이곳에 마감된 모집이 표시됩니다."
						tone="warning"
						steps={[
							<>
								봇 채널에서 <code className="kbd kbd-sm">/내전모집</code> 입력
							</>,
							<>
								정원 도달 시 모집 메시지의{" "}
								<span className="badge badge-success badge-sm">▶ 엔트리 수정 시작</span>{" "}
								버튼 클릭
							</>,
							<>이곳에서 카드 클릭 → 엔트리 수정 화면으로 이동</>,
						]}
					/>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						{recruitments.map((r) => (
							<RecruitmentCard
								key={r.id}
								rec={r}
								onClick={() => onSelectRecruitment(r.id)}
							/>
						))}
					</div>
				)}
			</div>

			{/* 진행중인 내전 */}
			<div className="space-y-2">
				<h2 className="text-lg font-bold">진행중인 내전</h2>
				{isLoading ? (
					<SkeletonGrid />
				) : series.length === 0 ? (
					<EmptyState
						title="진행중인 내전이 없습니다"
						description="엔트리 제출 시 시리즈가 생성되어 이곳에 표시됩니다."
						steps={[
							<>위 "엔트리 수정 대기" 카드 선택 → 슬롯 보드 작성</>,
							<>
								<strong>엔트리 제출</strong> → 시리즈 자동 생성
							</>,
							<>Activity 재실행되어도 이곳에서 이어서 픽/밴 진행 가능</>,
						]}
					/>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						{series.map((s) => (
							<SeriesCard key={s.id} series={s} onClick={() => onSelectSeries(s.id)} />
						))}
					</div>
				)}
			</div>

			{/* 지난 내전 (종료) */}
			<div className="space-y-2">
				<h2 className="text-lg font-bold">지난 내전</h2>
				{isLoading ? (
					<SkeletonGrid />
				) : completed.length === 0 ? (
					<EmptyState
						title="아직 종료된 내전이 없습니다"
						description="시리즈가 종료되면 이곳에서 게임별 픽/밴 결과를 다시 볼 수 있습니다."
					/>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						{completed.map((s) => (
							<CompletedSeriesCard
								key={s.id}
								series={s}
								onClick={() => onSelectCompletedSeries(s.id)}
							/>
						))}
					</div>
				)}
			</div>
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
	const winner = series.winningTeam === "TEAM_1" ? "1팀" : series.winningTeam === "TEAM_2" ? "2팀" : "—";
	const winnerColor =
		series.winningTeam === "TEAM_1" ? "text-info" : series.winningTeam === "TEAM_2" ? "text-error" : "";
	return (
		<button
			type="button"
			onClick={onClick}
			className="card bg-base-200 shadow-sm hover:bg-base-300 transition cursor-pointer text-left"
		>
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
					<div className="bg-base-100 rounded p-2 mt-1">
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
		<button
			type="button"
			onClick={onClick}
			className="card bg-base-200 shadow-sm hover:bg-base-300 transition cursor-pointer text-left"
		>
			<div className="card-body py-4">
				<div className="flex items-center justify-between">
					<h3 className="card-title text-base">
						{teamSize}v{teamSize} 내전
					</h3>
					<span className="badge badge-warning badge-sm">엔트리 대기</span>
				</div>
				<div className="text-sm text-base-content/70">
					모집 #{rec.id} · {formatAgo(rec.createdAt)}
				</div>
			</div>
		</button>
	);
}

function SeriesCard({ series, onClick }: { series: SeriesItem; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="card bg-base-200 shadow-sm hover:bg-base-300 transition cursor-pointer text-left"
		>
			<div className="card-body py-4 gap-3">
				<div className="flex items-center justify-between">
					<h3 className="card-title text-base">시리즈 #{series.id}</h3>
					<span className="badge badge-info badge-sm">{series.status}</span>
				</div>
				<div className="text-xs text-base-content/60">
					시즌 {series.seasonId} · 시작 {formatAgo(series.startedAt)}
				</div>
				{series.participants.length > 0 && (
					<div className="bg-base-100 rounded p-3">
						<LineupPreview participants={series.participants} compact />
					</div>
				)}
			</div>
		</button>
	);
}

function SkeletonGrid() {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
			{[0, 1].map((i) => (
				<div key={i} className="card bg-base-200 shadow-sm">
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
