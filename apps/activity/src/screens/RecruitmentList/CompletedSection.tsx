import { EmptyState } from "../../components/EmptyState.js";
import { CompletedSeriesCard, SkeletonGrid } from "../../features/dashboard/DashboardCards.js";
import type { CompletedSeries } from "../../features/dashboard/types.js";

export function CompletedSection({
	isLoading,
	completed,
	completedTotal,
	page,
	totalPages,
	setPage,
	onSelectCompletedSeries,
}: {
	isLoading: boolean;
	completed: CompletedSeries[];
	completedTotal: number;
	page: number;
	totalPages: number;
	setPage: React.Dispatch<React.SetStateAction<number>>;
	onSelectCompletedSeries: (id: number) => void;
}) {
	return (
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
							{completed.map((series) => (
								<CompletedSeriesCard
									key={series.id}
									series={series}
									onClick={() => onSelectCompletedSeries(series.id)}
								/>
							))}
						</div>
						{totalPages > 1 && <Pagination page={page} totalPages={totalPages} setPage={setPage} />}
					</>
				)}
			</div>
		</details>
	);
}

function Pagination({
	page,
	totalPages,
	setPage,
}: {
	page: number;
	totalPages: number;
	setPage: React.Dispatch<React.SetStateAction<number>>;
}) {
	return (
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
	);
}
