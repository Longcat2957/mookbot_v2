import { IconButton, InlineNotice } from "../../components/DesignPrimitives.js";

export function EntryReadOnlyNotice({ onDismiss }: { onDismiss: () => void }) {
	return (
		<InlineNotice
			tone="warning"
			action={
				<IconButton label="알림 닫기" className="btn-xs" onClick={onDismiss}>
					✕
				</IconButton>
			}
		>
			👁 관전 중 — 운영자 role 이 있어야 엔트리를 변경할 수 있습니다.
		</InlineNotice>
	);
}
