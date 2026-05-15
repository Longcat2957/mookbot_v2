import { InteractivePanelCard, PanelCard, StatusBadge } from "../../components/DesignPrimitives.js";
import { LineupPreview } from "../../components/LineupPreview.js";
import type { CompletedSeries, Recruitment, SeriesItem } from "./types.js";

export function CompletedSeriesCard({
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
		<InteractivePanelCard status="success" onClick={onClick} bodyClassName="py-4 gap-2">
			<div className="flex items-center justify-between">
				<h3 className="card-title text-base">시리즈 #{series.id}</h3>
				<StatusBadge tone="success">종료</StatusBadge>
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
		</InteractivePanelCard>
	);
}

export function RecruitmentCard({ rec, onClick }: { rec: Recruitment; onClick: () => void }) {
	const teamSize = rec.targetCount / 2;
	return (
		<InteractivePanelCard status="warning" onClick={onClick} bodyClassName="py-4 gap-1">
			<div className="flex items-center justify-between">
				<h3 className="card-title text-base">
					{teamSize}v{teamSize} 내전
				</h3>
				<StatusBadge tone="warning">엔트리 대기</StatusBadge>
			</div>
			<div className="text-sm text-base-content/70">
				모집 #{rec.id} · {formatAgo(rec.createdAt)}
			</div>
			<div className="text-xs text-base-content/50 mt-1">→ 클릭하여 엔트리 수정 화면으로</div>
		</InteractivePanelCard>
	);
}

export function SeriesCard({ series, onClick }: { series: SeriesItem; onClick: () => void }) {
	return (
		<InteractivePanelCard status="info" onClick={onClick} bodyClassName="py-4 gap-2">
			<div className="flex items-center justify-between">
				<h3 className="card-title text-base flex items-center gap-2">
					시리즈 #{series.id}
					<span className="inline-grid *:[grid-area:1/1]">
						<span className="status status-success animate-ping" aria-hidden="true" />
						<span className="status status-success" role="status" aria-label="라이브" />
					</span>
				</h3>
				<StatusBadge tone="info">{series.status}</StatusBadge>
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
		</InteractivePanelCard>
	);
}

export function SkeletonGrid() {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
			{[0, 1].map((i) => (
				<PanelCard key={i} bodyClassName="py-4 gap-3">
					<div className="flex items-center justify-between gap-3">
						<div className="skeleton h-6 w-32" />
						<div className="skeleton h-5 w-14" />
					</div>
					<div className="skeleton h-4 w-48 max-w-full" />
					<div className="skeleton h-12 w-full" />
				</PanelCard>
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
