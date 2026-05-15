import { ParticipantCard } from "./ParticipantCard.js";
import type { UseEntryEditingStateResult } from "./useEntryEditingState.js";

export function CandidatePool({
	state,
	canEdit,
	coarse,
}: {
	state: UseEntryEditingStateResult;
	canEdit: boolean;
	coarse: boolean;
}) {
	if (!state.detail) return null;
	const { participants } = state.detail;
	const canMoveSelectedToPool =
		state.selectedUid !== null && state.assignment.has(state.selectedUid);

	return (
		<section
			aria-label="후보 풀"
			className={`card surface-base shadow-sm transition ${
				canMoveSelectedToPool ? "ring-2 ring-primary" : ""
			}`}
			onDragOver={(e) => e.preventDefault()}
			onDrop={(e) => {
				const uid = e.dataTransfer.getData("text/plain");
				if (uid) state.moveTo(uid, null);
			}}
		>
			<div className="card-body p-3 gap-2">
				<div className="flex items-center justify-between flex-wrap gap-2">
					<h3 className="card-title text-base">
						후보 풀 · {state.unassigned.length}명 미배정 / 총 {participants.length}명
					</h3>
					{canEdit && (
						<div className="flex items-center gap-1.5 flex-wrap">
							{canMoveSelectedToPool && (
								<button
									type="button"
									className="btn btn-xs btn-secondary"
									onClick={state.handlePoolTap}
									disabled={state.submitting}
								>
									후보 풀로 이동
								</button>
							)}
							<button
								type="button"
								className="btn btn-xs btn-primary"
								onClick={state.autoAssign}
								disabled={state.submitting}
								title="라인 선호 + 셔플로 자동 배치 — 다시 누르면 재셔플"
							>
								🎯 라인 자동 배치
							</button>
							<div className="join">
								<button
									type="button"
									className="btn btn-xs join-item"
									onClick={state.undo}
									disabled={!state.canUndo}
									title="Undo (Ctrl+Z)"
									aria-label="Undo"
								>
									↶
								</button>
								<button
									type="button"
									className="btn btn-xs join-item"
									onClick={state.redo}
									disabled={!state.canRedo}
									title="Redo (Ctrl+Shift+Z)"
									aria-label="Redo"
								>
									↷
								</button>
							</div>
						</div>
					)}
					<span className="text-xs text-base-content/50">
						{coarse ? "탭하여 선택 → 슬롯 탭으로 배치" : "탭하여 선택 → 슬롯 탭 (또는 드래그)"}
					</span>
				</div>
				{state.unassigned.length === 0 ? (
					<div className="text-center text-base-content/50 py-4 text-sm">
						모든 참가자가 슬롯에 배정되었습니다.
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
						{state.unassigned.map((p) => (
							<ParticipantCard
								key={p.userId}
								participant={p}
								selected={state.selectedUid === p.userId}
								onTap={() => state.handleParticipantTap(p.userId)}
								recentlyChanged={state.recentlyChanged.has(p.userId)}
							/>
						))}
					</div>
				)}
			</div>
		</section>
	);
}
