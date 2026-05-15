export function DashboardHeader({ onRefresh }: { onRefresh: () => void }) {
	return (
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
				onClick={onRefresh}
				title="새로고침"
				aria-label="새로고침"
			>
				↻
			</button>
		</div>
	);
}
