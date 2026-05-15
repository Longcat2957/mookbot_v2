import { InlineNotice, PanelCard, SectionHeader } from "../components/DesignPrimitives.js";
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
	onEditSeries,
}: {
	seriesId: number | null;
	onBack: () => void;
	onSelectUser?: (userId: string) => void;
	onEditSeries?: (seriesId: number) => void;
}) {
	const { champById, detail, error } = useSeriesResultData(seriesId);

	if (seriesId === null) {
		return <InlineNotice tone="warning">시리즈를 선택하세요.</InlineNotice>;
	}
	if (error) {
		return (
			<div className="space-y-3">
				<InlineNotice tone="error">{error}</InlineNotice>
				<button type="button" className="btn btn-sm" onClick={onBack}>
					← 대시보드
				</button>
			</div>
		);
	}
	if (!detail) return <SeriesResultSkeleton />;

	return (
		<section className="space-y-4">
			<SectionHeader
				title={
					<button type="button" className="btn btn-sm btn-ghost" onClick={onBack}>
						← 대시보드
					</button>
				}
				actions={
					<div className="flex items-center gap-2 flex-wrap justify-end">
						<div className="text-xs text-base-content/60">{seriesMetaLabel(detail)}</div>
						{onEditSeries && (
							<button
								type="button"
								className="btn btn-sm btn-outline"
								onClick={() => onEditSeries(seriesId)}
								title="픽/밴 화면에서 직전 게임을 되돌린 뒤 수정할 수 있습니다."
							>
								픽/밴 수정
							</button>
						)}
					</div>
				}
			/>

			<SeriesResultHero detail={detail} />

			<PanelCard bodyClassName="p-0">
				<details className="collapse collapse-arrow">
					<summary className="collapse-title text-sm font-medium py-2 min-h-0 px-4">라인업 보기</summary>
					<div className="collapse-content px-4">
						<LineupPreview
							participants={detail.participants}
							{...(onSelectUser ? { onSelectUser } : {})}
						/>
					</div>
				</details>
			</PanelCard>

			<GameTimeline
				champById={champById}
				games={detail.games}
				participants={detail.participants}
				{...(onSelectUser ? { onSelectUser } : {})}
			/>
		</section>
	);
}
