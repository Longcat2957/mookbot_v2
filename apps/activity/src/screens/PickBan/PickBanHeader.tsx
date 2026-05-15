import { ConfirmButton } from "../../components/ConfirmButton.js";
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
		<header className="flex items-center justify-between flex-wrap gap-2">
			<div>
				<h2 className="text-xl font-bold flex items-center gap-3">
					픽 / 밴
					{canEdit && (
						<SaveStatusIndicator
							status={state.saveStatus}
							savedAt={state.savedAt}
							onRetry={state.retrySave}
						/>
					)}
				</h2>
				<p className="text-xs text-base-content/70">
					시리즈 #{state.detail.series.id} · {state.teamSize}v{state.teamSize} ·{" "}
					{state.detail.games.length}/3 게임 완료
					{state.seriesCompleted && (
						<span className="ml-2 badge badge-success badge-sm">시리즈 종료</span>
					)}
				</p>
			</div>
			<div className="flex items-center gap-1">
				<button
					type="button"
					className="btn btn-sm btn-ghost"
					onClick={state.refresh}
					title="새로고침"
					aria-label="새로고침"
				>
					↻
				</button>
				{canEdit && (state.noGamesPlayed || !state.seriesCompleted) && (
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
									? "직전 게임 결과 + MMR 변동을 취소합니다."
									: "시리즈를 삭제하고 모집을 엔트리 수정 대기 상태로 되돌립니다."}
							</div>
						</div>
					</details>
				)}
			</div>
		</header>
	);
}
