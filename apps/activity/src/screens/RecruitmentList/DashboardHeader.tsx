import { IconButton, SectionHeader } from "../../components/DesignPrimitives.js";

export function DashboardHeader({ onRefresh }: { onRefresh: () => void }) {
	return (
		<SectionHeader
			title={<span className="text-2xl tracking-tight">대시보드</span>}
			description="처리 대기 카드 클릭 → 엔트리 작성 또는 픽/밴 입력"
			actions={
				<IconButton label="새로고침" tooltip="새로고침" onClick={onRefresh}>
					↻
				</IconButton>
			}
			className="items-end"
		/>
	);
}
