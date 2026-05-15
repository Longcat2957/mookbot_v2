export function EntryReadOnlyNotice({ onDismiss }: { onDismiss: () => void }) {
	return (
		<div className="alert alert-warning">
			<span>👁 관전 중 — 운영자 role 이 있어야 엔트리를 변경할 수 있습니다.</span>
			<button
				type="button"
				className="btn btn-ghost btn-xs"
				onClick={onDismiss}
				aria-label="알림 닫기"
			>
				✕
			</button>
		</div>
	);
}
