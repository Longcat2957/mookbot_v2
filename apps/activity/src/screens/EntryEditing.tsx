// [2] 엔트리 수정 — 드래그&드롭 슬롯 보드 (1팀 / 2팀).
// 후보 풀의 카드를 1팀 / 2팀 라인 슬롯으로 끌어다 놓아 엔트리 작성.
//
// 상태 / SWR / 저장 / WS / Tap-to-Place / 액션 은 ./EntryEditing/useEntryEditingState.ts 에 응집.
// 이 파일은 layout + props wiring 만.

import { useEffect, useState } from "react";
import { InlineNotice } from "../components/DesignPrimitives.js";
import { usePerms } from "../state/perms.js";
import { useCoarsePointer } from "../state/useCoarsePointer.js";
import { CandidatePool } from "./EntryEditing/CandidatePool.js";
import { CoinTossPanel } from "./EntryEditing/CoinTossPanel.js";
import { EntryEditingHeader } from "./EntryEditing/EntryEditingHeader.js";
import { EntryEditingSkeleton } from "./EntryEditing/EntryEditingSkeleton.js";
import { EntryReadOnlyNotice } from "./EntryEditing/EntryReadOnlyNotice.js";
import { SelectedParticipantAlert } from "./EntryEditing/SelectedParticipantAlert.js";
import { SlotBoard } from "./EntryEditing/SlotBoard.js";
import { useEntryEditingState } from "./EntryEditing/useEntryEditingState.js";

export function EntryEditing({
	recruitmentId,
	onSubmit,
	onReopened,
}: {
	recruitmentId: number | null;
	onSubmit: (seriesId: number) => void;
	onReopened: () => void;
}) {
	const perms = usePerms();
	const s = useEntryEditingState({ recruitmentId });
	const coarse = useCoarsePointer();

	// 관전 모드 — read-only alert dismissible (세션 단위). design_upgrade.md §6.7
	const dismissKey = recruitmentId !== null ? `readonly-dismissed-rec-${recruitmentId}` : "";
	const [readOnlyDismissed, setReadOnlyDismissed] = useState(false);
	useEffect(() => {
		if (!dismissKey) return;
		setReadOnlyDismissed(sessionStorage.getItem(dismissKey) === "1");
	}, [dismissKey]);

	if (recruitmentId === null) {
		return (
			<InlineNotice tone="warning">
				모집을 먼저 선택해주세요. (좌측 상단 monkey 클릭 → 대시보드)
			</InlineNotice>
		);
	}
	if (s.error) {
		return (
			<div className="space-y-3">
				<InlineNotice tone="error">모집 정보를 불러오지 못했습니다: {s.error}</InlineNotice>
				<button type="button" className="btn btn-sm btn-outline" onClick={s.refresh}>
					↻ 새로고침
				</button>
			</div>
		);
	}
	if (!s.detail) {
		return <EntryEditingSkeleton />;
	}

	const handleSubmit = async () => {
		const res = await s.submit();
		if (res) onSubmit(res.seriesId);
	};

	return (
		<section className="space-y-3">
			<EntryEditingHeader
				state={s}
				canEdit={perms.canEdit}
				onSubmit={handleSubmit}
				onReopened={onReopened}
			/>

			{!perms.canEdit && !readOnlyDismissed && (
				<EntryReadOnlyNotice
					onDismiss={() => {
						if (dismissKey) sessionStorage.setItem(dismissKey, "1");
						setReadOnlyDismissed(true);
					}}
				/>
			)}

			{s.submitError && <InlineNotice tone="error">제출 실패: {s.submitError}</InlineNotice>}

			{perms.canEdit && <CoinTossPanel state={s} />}
			<SelectedParticipantAlert state={s} />
			<SlotBoard state={s} />
			<CandidatePool state={s} canEdit={perms.canEdit} coarse={coarse} />
		</section>
	);
}
