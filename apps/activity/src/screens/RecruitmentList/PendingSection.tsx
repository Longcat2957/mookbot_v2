import { SectionHeader, StatusBadge } from "../../components/DesignPrimitives.js";
import { EmptyState } from "../../components/EmptyState.js";
import {
	RecruitmentCard,
	SeriesCard,
	SkeletonGrid,
} from "../../features/dashboard/DashboardCards.js";
import type { PendingItem, Recruitment, SeriesItem } from "../../features/dashboard/types.js";

export function PendingSection({
	isLoading,
	pending,
	recruitments,
	series,
	onSelectRecruitment,
	onSelectSeries,
}: {
	isLoading: boolean;
	pending: PendingItem[];
	recruitments: Recruitment[];
	series: SeriesItem[];
	onSelectRecruitment: (id: number) => void;
	onSelectSeries: (id: number) => void;
}) {
	return (
		<div className="space-y-2">
			<SectionHeader
				title={<span className="text-lg">처리 대기</span>}
				actions={
					!isLoading &&
					pending.length > 0 && (
						<div className="flex flex-wrap gap-1.5">
							<StatusBadge tone="warning" variant="outline">
								{recruitments.length} 엔트리
							</StatusBadge>
							<StatusBadge tone="info" variant="outline">
								{series.length} 진행 중
							</StatusBadge>
						</div>
					)
				}
			/>
			{isLoading ? (
				<SkeletonGrid />
			) : pending.length === 0 ? (
				<EmptyState
					title="처리할 항목이 없습니다"
					description="새 모집을 시작하거나, 엔트리를 제출해 시리즈를 만들면 여기에 표시됩니다."
					tone="warning"
					steps={[
						{
							id: "create-recruitment",
							content: (
								<>
									봇 채널에서 <code className="kbd kbd-sm">/내전모집</code> 입력
								</>
							),
						},
						{
							id: "start-entry-editing",
							content: (
								<>
									정원 도달 시 모집 메시지의{" "}
									<span className="badge badge-success badge-sm">▶ 엔트리 수정 시작</span> 버튼 클릭
								</>
							),
						},
						{
							id: "open-card",
							content: <>이곳에서 카드 클릭 → 엔트리 수정 → 픽/밴 진행</>,
						},
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
	);
}
