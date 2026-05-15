// [4] 픽/밴 + 결과
// 게임별로 1팀/2팀이 BLUE/RED 어느 쪽으로 시작할지 선택 + 5밴 + 5픽 + 결과.
// pickban draft 는 series 단위로 guild_kv 에 JSON 보관, Activity 재실행 시 복원.
//
// 상태 / SWR / 저장 / WS / derived 는 ./PickBan/usePickBanState.ts 에 응집.
// 이 파일은 layout + props wiring 만.

import { useEffect, useState } from "react";
import { BalancePreview } from "../components/BalancePreview.js";
import { usePerms } from "../state/perms.js";
import { GameTabs } from "./PickBan/GameTabs.js";
import { PickBanBoard } from "./PickBan/PickBanBoard.js";
import { PickBanHeader } from "./PickBan/PickBanHeader.js";
import { PickBanSkeleton } from "./PickBan/PickBanSkeleton.js";
import { ReadOnlyNotice } from "./PickBan/ReadOnlyNotice.js";
import { ResultPanel } from "./PickBan/ResultPanel.js";
import { SeriesSummary } from "./PickBan/SeriesSummary.js";
import { SideSelector } from "./PickBan/SideSelector.js";
import { usePickBanShortcuts } from "./PickBan/usePickBanShortcuts.js";
import { usePickBanState } from "./PickBan/usePickBanState.js";
import { usePreviousPicks } from "./PickBan/usePreviousPicks.js";

export function PickBan({
	seriesId,
	onBack,
	onSelectUser,
}: {
	seriesId: number | null;
	onBack: () => void;
	onSelectUser?: (userId: string) => void;
}) {
	const perms = usePerms();
	const s = usePickBanState({ seriesId });

	// 관전 모드 alert dismissible (세션 단위) — design_upgrade.md §6.7
	const readOnlyDismissKey = seriesId !== null ? `readonly-dismissed-series-${seriesId}` : "";
	const [readOnlyDismissed, setReadOnlyDismissed] = useState(false);
	useEffect(() => {
		if (!readOnlyDismissKey) return;
		setReadOnlyDismissed(sessionStorage.getItem(readOnlyDismissKey) === "1");
	}, [readOnlyDismissKey]);

	const previousPicks = usePreviousPicks(s.detail, s.draft);

	// W1 키보드 단축키 — Ctrl+1/2/3 (Game 탭) + B/R (사이드 결정 시).
	// SoT: state/shortcuts.ts — HelpModal 이 표시하는 단축키 목록과 sync.
	// early return 전에 위치해야 hooks 호출 순서 일관성 유지 (React #310 회피).
	// team1Side 는 closure 안에서 s.draft 의 currentGame 으로 derive.
	usePickBanShortcuts({ canEdit: perms.canEdit, state: s });

	if (seriesId === null) {
		return (
			<div className="alert alert-warning">
				<span>시리즈를 먼저 선택해주세요.</span>
			</div>
		);
	}
	if (s.error) {
		return (
			<div className="space-y-3">
				<div className="alert alert-error">
					<span>시리즈 정보를 불러오지 못했습니다: {s.error}</span>
				</div>
				<button type="button" className="btn btn-sm btn-outline" onClick={s.refresh}>
					↻ 새로고침
				</button>
			</div>
		);
	}
	if (!s.detail || !s.draft || !s.currentGameDraft) return <PickBanSkeleton />;

	const detail = s.detail;
	const draft = s.draft;
	const currentGameDraft = s.currentGameDraft;
	const team1Side = s.team1Side;

	const handleRevert = async () => {
		if (await s.revert()) onBack();
	};

	return (
		<section className="space-y-3">
			<PickBanHeader state={s} canEdit={perms.canEdit} onRevert={handleRevert} />

			{s.actionError && (
				<div className="alert alert-error">
					<span>{s.actionError}</span>
				</div>
			)}

			{!perms.canEdit && (
				<ReadOnlyNotice
					dismissed={readOnlyDismissed}
					seriesCompleted={s.seriesCompleted}
					onDismiss={() => {
						if (readOnlyDismissKey) sessionStorage.setItem(readOnlyDismissKey, "1");
						setReadOnlyDismissed(true);
					}}
				/>
			)}

			<SeriesSummary state={s} onSelectUser={onSelectUser} />
			<GameTabs
				currentGame={draft.currentGame}
				detail={detail}
				completedGames={s.completedGames}
				isGameTabEnabled={s.isGameTabEnabled}
				onSelectGame={s.setCurrentGame}
			/>
			<SideSelector
				currentGame={draft.currentGame}
				team1Side={team1Side}
				team2Side={s.team2Side}
				canEdit={perms.canEdit}
				isRecorded={s.isCurrentGameRecorded}
				onSetSide={s.setSide}
			/>

			{/* Game 1 사이드 결정 + 첫 게임 미기록 + 시리즈 진행중 일 때만 밸런스 이미지 노출 */}
			{team1Side && draft.currentGame === 1 && !s.completedGames.has(1) && !s.seriesCompleted && (
				<BalancePreview team1Side={team1Side} participants={detail.participants} />
			)}

			{team1Side && (
				<PickBanBoard
					teamSize={s.teamSize}
					gameDraft={currentGameDraft}
					team1Side={team1Side}
					participants={detail.participants}
					champions={s.champions}
					fearlessUsedIds={s.fearlessUsedIds}
					previousPicks={previousPicks}
					onChange={s.setGameDraft}
				/>
			)}

			{/* 결과 입력 — 슬롯 다 채워졌고 사이드 결정 + 미기록 게임일 때만 노출 */}
			{team1Side && !s.isCurrentGameRecorded && !s.seriesCompleted && (
				<ResultPanel
					seriesId={seriesId}
					gameDraft={currentGameDraft}
					teamSize={s.teamSize}
					participants={detail.participants}
					champions={s.champions}
					onRecorded={s.refresh}
				/>
			)}

			{/* 게임 N 이미 기록됨 안내 */}
			{s.isCurrentGameRecorded && (
				<div className="alert alert-success">
					<span>Game {draft.currentGame} 결과가 이미 기록되었습니다.</span>
				</div>
			)}
		</section>
	);
}
