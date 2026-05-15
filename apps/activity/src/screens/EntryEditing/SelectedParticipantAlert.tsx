import type { UseEntryEditingStateResult } from "./useEntryEditingState.js";

export function SelectedParticipantAlert({ state }: { state: UseEntryEditingStateResult }) {
	if (!state.detail || !state.selectedUid) return null;
	const selected = state.detail.participants.find((p) => p.userId === state.selectedUid);
	if (!selected) return null;

	const inSlot = state.assignment.has(state.selectedUid);
	return (
		<div className="alert alert-info alert-soft sticky top-2 z-10">
			<span>
				🎯 <strong>{selected.displayName}</strong> 선택됨 — {inSlot ? "다른 슬롯 또는 후보 풀" : "슬롯"}
				을 탭하여 배치
				<span className="text-xs opacity-70 ml-2">(Esc 취소)</span>
			</span>
			<button type="button" className="btn btn-xs btn-ghost" onClick={state.clearSelected}>
				✕ 취소
			</button>
		</div>
	);
}
