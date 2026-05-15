import { SaveStatusIndicator } from "../../components/SaveStatus.js";
import type { UseEntryEditingStateResult } from "./useEntryEditingState.js";

export function EntryEditingHeader({
	state,
	canEdit,
	onSubmit,
}: {
	state: UseEntryEditingStateResult;
	canEdit: boolean;
	onSubmit: () => Promise<void>;
}) {
	if (!state.detail) return null;

	const { recruitment, participants } = state.detail;
	const submitTip = !canEdit
		? "쓰기 권한이 없습니다 (읽기 전용)"
		: !state.allFilled
			? `모든 슬롯을 채워야 제출 가능합니다 (${state.assignment.size}/${recruitment.targetCount})`
			: undefined;
	const submitButton = (
		<button
			type="button"
			className="btn btn-sm btn-primary join-item"
			onClick={onSubmit}
			disabled={!state.allFilled || state.submitting || !canEdit}
		>
			{state.submitting ? (
				<>
					<span className="loading loading-spinner loading-xs" />
					제출 중…
				</>
			) : (
				"엔트리 제출"
			)}
		</button>
	);

	return (
		<header className="flex items-center justify-between flex-wrap gap-2">
			<div>
				<h2 className="text-xl font-bold flex items-center gap-3">
					엔트리 수정
					{canEdit && (
						<SaveStatusIndicator
							status={state.saveStatus}
							savedAt={state.savedAt}
							onRetry={state.retrySave}
						/>
					)}
				</h2>
				<p className="text-xs text-base-content/70">
					모집 #{recruitment.id} · {state.teamSize}v{state.teamSize} · 후보 {participants.length}명
					{" · "}
					배정{" "}
					<span className="font-bold tabular-nums">
						{state.assignment.size}/{recruitment.targetCount}
					</span>
				</p>
			</div>
			<div className="join">
				<button
					type="button"
					className="btn btn-sm btn-ghost join-item"
					onClick={state.refresh}
					title="새로고침"
					disabled={state.submitting}
				>
					↻
				</button>
				<button
					type="button"
					className="btn btn-sm btn-ghost join-item"
					onClick={state.swapTeams}
					title="1팀과 2팀의 좌/우 위치를 바꿉니다"
					aria-label="1팀과 2팀 좌우 바꾸기"
					disabled={state.submitting || !canEdit || state.assignment.size === 0}
				>
					↔ 좌/우 바꾸기
				</button>
				{submitTip ? (
					<span className="tooltip tooltip-bottom join-item" data-tip={submitTip}>
						{submitButton}
					</span>
				) : (
					submitButton
				)}
			</div>
		</header>
	);
}
