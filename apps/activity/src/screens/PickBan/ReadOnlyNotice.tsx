import { IconButton, InlineNotice } from "../../components/DesignPrimitives.js";

export function ReadOnlyNotice({
	dismissed,
	seriesCompleted,
	onDismiss,
}: {
	dismissed: boolean;
	seriesCompleted: boolean;
	onDismiss: () => void;
}) {
	if (dismissed && !seriesCompleted) {
		return (
			<div className="text-xs text-base-content/60 flex items-center gap-1.5">
				<span className="size-1.5 rounded-full bg-success animate-pulse" aria-hidden />
				라이브 — 방장 입력 시 자동 갱신
			</div>
		);
	}
	if (dismissed) return null;

	return (
		<InlineNotice
			tone="warning"
			action={
				<IconButton label="알림 닫기" className="btn-xs" onClick={onDismiss}>
					✕
				</IconButton>
			}
		>
			👁 관전 중 — 이 Activity 방을 연 사람이 픽/밴/결과를 입력하면 자동으로 갱신됩니다.
		</InlineNotice>
	);
}
