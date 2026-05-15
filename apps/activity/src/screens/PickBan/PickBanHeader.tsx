import { ConfirmButton } from "../../components/ConfirmButton.js";
import { IconButton, SectionHeader, StatusBadge } from "../../components/DesignPrimitives.js";
import { SaveStatusIndicator } from "../../components/SaveStatus.js";
import type { UsePickBanStateResult } from "./usePickBanState.js";

export function PickBanHeader({
	state,
	canEdit,
	onRevert,
}: {
	state: UsePickBanStateResult;
	canEdit: boolean;
	onRevert: () => Promise<void>;
}) {
	if (!state.detail || !state.draft) return null;

	return (
		<header>
			<SectionHeader
				title={
					<span className="text-xl flex items-center gap-3">
						픽 / 밴
						{canEdit && (
							<SaveStatusIndicator
								status={state.saveStatus}
								savedAt={state.savedAt}
								onRetry={state.retrySave}
							/>
						)}
					</span>
				}
				description={
					<span>
						시리즈 #{state.detail.series.id} · {state.teamSize}v{state.teamSize} ·{" "}
						{state.detail.games.length}/3 게임 완료
					</span>
				}
				actions={
					<div className="flex items-center gap-1">
						{state.seriesCompleted && <StatusBadge tone="success">시리즈 종료</StatusBadge>}
						<IconButton label="새로고침" tooltip="새로고침" onClick={state.refresh}>
							↻
						</IconButton>
						{canEdit && (
							<details className="dropdown dropdown-end">
								<summary className="btn btn-sm btn-ghost list-none after:content-none" aria-label="더 보기">
									⋯
								</summary>
								<div className="dropdown-content bg-base-100 rounded-box z-30 w-64 p-2 shadow-lg border border-base-300 space-y-1">
									<div className="text-xs uppercase tracking-wide text-base-content/60 px-2 pt-1 pb-0.5">
										위험한 액션
									</div>
									{!state.noGamesPlayed && (
										<ConfirmButton
											label="↺ 직전 게임 되돌리기"
											onConfirm={state.undoLast}
											variant="error"
											className="w-full justify-start"
										/>
									)}
									{state.noGamesPlayed && (
										<ConfirmButton
											label="↩ 엔트리 수정 대기로"
											onConfirm={onRevert}
											variant="warning"
											className="w-full justify-start"
										/>
									)}
									<div className="text-[10px] text-base-content/50 px-2 pt-1 leading-snug">
										{!state.noGamesPlayed
											? "직전 게임 결과 + MMR 변동을 취소합니다. 완료된 시리즈도 마지막 게임을 되돌린 뒤 다시 기록할 수 있습니다."
											: "시리즈를 삭제하고 모집을 엔트리 수정 대기 상태로 되돌립니다."}
									</div>
								</div>
							</details>
						)}
					</div>
				}
			/>
		</header>
	);
}
