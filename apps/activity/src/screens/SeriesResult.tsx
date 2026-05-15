import { LineupPreview } from "../components/LineupPreview.js";
import { GameTimeline } from "./SeriesResult/GameTimeline.js";
import { SeriesResultHero } from "./SeriesResult/SeriesResultHero.js";
import { SeriesResultSkeleton } from "./SeriesResult/SeriesResultSkeleton.js";
import { seriesMetaLabel } from "./SeriesResult/seriesResultStats.js";
import { useSeriesResultData } from "./SeriesResult/useSeriesResultData.js";

export function SeriesResult({
	seriesId,
	onBack,
	onSelectUser,
}: {
	seriesId: number | null;
	onBack: () => void;
	onSelectUser?: (userId: string) => void;
}) {
	const { champById, detail, error } = useSeriesResultData(seriesId);

	if (seriesId === null) {
		return (
			<div className="alert alert-warning">
				<span>시리즈를 선택하세요.</span>
			</div>
		);
	}
	if (error) {
		return (
			<div className="space-y-3">
				<div className="alert alert-error">
					<span>{error}</span>
				</div>
				<button type="button" className="btn btn-sm" onClick={onBack}>
					← 대시보드
				</button>
			</div>
		);
	}
	if (!detail) return <SeriesResultSkeleton />;

	return (
		<section className="space-y-4">
			<div className="flex items-center justify-between flex-wrap gap-2">
				<button type="button" className="btn btn-sm btn-ghost" onClick={onBack}>
					← 대시보드
				</button>
				<div className="text-xs text-base-content/60">{seriesMetaLabel(detail)}</div>
			</div>

			<SeriesResultHero detail={detail} />

			<details className="collapse collapse-arrow bg-base-200">
				<summary className="collapse-title text-sm font-medium py-2 min-h-0 px-4">라인업 보기</summary>
				<div className="collapse-content px-4">
					<LineupPreview
						participants={detail.participants}
						{...(onSelectUser ? { onSelectUser } : {})}
					/>
				</div>
			</details>

			<GameTimeline
				champById={champById}
				games={detail.games}
				participants={detail.participants}
				{...(onSelectUser ? { onSelectUser } : {})}
			/>
		</section>
	);
}
