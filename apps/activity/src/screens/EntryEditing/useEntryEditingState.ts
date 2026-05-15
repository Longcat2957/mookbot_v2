// EntryEditing 화면의 상태 / SWR / 저장 / WS / Tap-to-Place / 액션 묶음.
// 화면 컴포넌트 (EntryEditing.tsx) 는 이 hook 의 반환값을 layout 에 wiring 만 함.

import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/rest.js";
import { wsClient } from "../../api/ws.js";
import type { SaveStatus } from "../../components/SaveStatus.js";
import { showToast } from "../../components/Toaster.js";
import { usePerms } from "../../state/perms.js";
import { useStaleWhileRevalidate } from "../../state/useStaleWhileRevalidate.js";
import {
	activeLanesForTeamSize,
	assignmentFromDraft,
	autoAssignByPreference,
	changedAssignmentUids,
	isAssignmentFilled,
	moveUserToSlot,
	serializeAssignment,
	swapAssignmentTeams,
} from "./entryAssignment.js";
import {
	type Assignment,
	LANES,
	type Lane,
	type Participant,
	type RecruitmentDetail,
	type Slot,
} from "./types.js";
import { useEntryDraftAutosave } from "./useEntryDraftAutosave.js";
import { useEntryHistory } from "./useEntryHistory.js";
import { useEntrySelection } from "./useEntrySelection.js";
import { useEntrySubmit } from "./useEntrySubmit.js";
import { useEntryUndoShortcuts } from "./useEntryUndoShortcuts.js";
import { useRecentAssignmentChanges } from "./useRecentAssignmentChanges.js";

export interface UseEntryEditingStateResult {
	// data
	detail: RecruitmentDetail | null;
	assignment: Assignment;
	error: string | null;
	// save status
	saveStatus: SaveStatus;
	savedAt: number | null;
	retrySave: () => void;
	// submit
	submitting: boolean;
	submitError: string | null;
	submit: () => Promise<{ seriesId: number } | null>;
	// derived (detail 이 있을 때만 의미)
	teamSize: number;
	activeLanes: Lane[];
	unassigned: Participant[];
	allFilled: boolean;
	// 다른 운영자 변경 시 ring pulse
	recentlyChanged: Set<string>;
	// tap-to-place
	selectedUid: string | null;
	clearSelected: () => void;
	// 액션
	moveTo: (userId: string, slot: Slot | null) => void;
	swapTeams: () => void;
	handleParticipantTap: (userId: string) => void;
	handleSlotTap: (slot: Slot, occupantUserId: string | null) => void;
	handlePoolTap: () => void;
	refresh: () => void;
	// W5 — 자동 배치 + Undo/Redo
	autoAssign: () => void;
	undo: () => void;
	redo: () => void;
	canUndo: boolean;
	canRedo: boolean;
	// 코인토스 — BLUE 사이드 결정. 결정 시 1팀이 BLUE 가 되도록 swap 자동 (TEAM_2 선택 시).
	// submit 시 team1Side="BLUE" 가 POST /series 에 전송 → PickBan 사이드 결정 카드 skip.
	coinTossDecided: boolean;
	setCoinTossWinner: (winnerTeam: "TEAM_1" | "TEAM_2") => void;
	clearCoinToss: () => void;
}

export function useEntryEditingState({
	recruitmentId,
}: {
	recruitmentId: number | null;
}): UseEntryEditingStateResult {
	const [assignment, setAssignment] = useState<Assignment>(new Map());
	const { recentlyChanged, markRecentlyChanged } = useRecentAssignmentChanges();
	const perms = usePerms();

	// SWR — fetch 중 화면을 비우지 않고, 본인 dirty 변경은 incoming 에 덮이지
	// 않게 보호 (hot_fix.md §3.3).
	const fetcher = useCallback(
		() => api<RecruitmentDetail>(`/recruitments/${recruitmentId}`),
		[recruitmentId],
	);
	const swr = useStaleWhileRevalidate<RecruitmentDetail>(recruitmentId, fetcher, {
		debounceMs: 150,
		enabled: recruitmentId !== null,
		onApply: (next, prev) => {
			const incoming = assignmentFromDraft(next.entryDraft?.assignments);
			const incomingSerialized = serializeAssignment(incoming);
			if (prev === null) {
				// 첫 로드 — server draft 무조건 반영
				setAssignment(incoming);
				lastSaved.current = incomingSerialized;
				return;
			}
			// 변경된 user 추출 — incoming pulse 표시용 (적용 여부와 별개로 diff 는 항상 수집)
			const prevMap = assignmentFromDraft(prev.entryDraft?.assignments);
			const changedUids = changedAssignmentUids(prevMap, incoming);
			markRecentlyChanged(changedUids);
			// 본인 dirty (lastSaved 와 다름) 면 incoming 무시 — 본인의 다음 PUT 이
			// last-write-wins 로 정렬됨. clean 이면 server 값으로 동기화.
			const localSerialized = serializeAssignment(assignment);
			const isLocalDirty = localSerialized !== lastSaved.current;
			if (!isLocalDirty) {
				setAssignment(incoming);
				lastSaved.current = incomingSerialized;
			}
		},
	});
	const detail = swr.data;
	const error = swr.error;
	const { saveStatus, savedAt, retrySave, lastSaved } = useEntryDraftAutosave({
		recruitmentId,
		canEdit: perms.canEdit,
		detail,
		assignment,
	});

	// recruitment topic 구독 — 다른 사용자 변경 시 background refresh (플리커 X).
	useEffect(() => {
		if (recruitmentId === null) return;
		return wsClient.subscribe(`recruitment:${recruitmentId}`, () => {
			swr.refresh();
			showToast("다른 운영자가 엔트리를 수정했습니다");
		});
	}, [recruitmentId, swr]);

	// derived
	const teamSize = detail ? detail.recruitment.targetCount / 2 : 0;
	const activeLanes = activeLanesForTeamSize(teamSize);
	const unassigned = detail ? detail.participants.filter((p) => !assignment.has(p.userId)) : [];
	const allFilled = isAssignmentFilled(assignment, activeLanes);

	// 액션
	const moveTo = useCallback((userId: string, slot: Slot | null) => {
		setAssignment((prev) => moveUserToSlot(prev, userId, slot));
	}, []);
	const selection = useEntrySelection({
		canEdit: perms.canEdit,
		moveTo,
	});

	// 좌/우 swap — 1팀↔2팀 을 한 번에 뒤집어 시각 위치 변경. 1팀/2팀이
	// BLUE/RED 와 헷갈리는 상황에서 운영자가 직접 좌우를 조정할 수 있게 함.
	// role 은 그대로, team 만 토글. 빈 슬롯도 그대로 (Map 키 변경 없음).
	const swapTeams = useCallback(() => {
		setAssignment((prev) => swapAssignmentTeams(prev));
	}, []);

	// 코인토스 — BLUE 사이드 결정 여부. 결정 시 항상 "1팀 = BLUE" 가 되도록 swap 자동.
	const [coinTossDecided, setCoinTossDecided] = useState(false);
	const { submitting, submitError, submit } = useEntrySubmit({
		allFilled,
		assignment,
		recruitmentId,
		coinTossDecided,
	});

	const history = useEntryHistory({
		setAssignment,
		clearSelected: selection.clearSelected,
	});

	// 기존 moveTo / swapTeams 호출 직전에 pushHistory 추가. 새 함수 wrap.
	const moveToWithHistory = useCallback(
		(userId: string, slot: Slot | null) => {
			history.pushHistory(assignment);
			moveTo(userId, slot);
		},
		[history, assignment, moveTo],
	);
	const swapTeamsWithHistory = useCallback(() => {
		history.pushHistory(assignment);
		swapTeams();
		selection.clearSelected();
	}, [history, assignment, swapTeams, selection.clearSelected]);

	// W5 — 자동 배치 (client-side, participant.roles[]/history.topRole 기반 + 셔플).
	const autoAssign = useCallback(() => {
		if (!detail || !perms.canEdit) return;
		const lanes =
			activeLanes.length > 0 ? activeLanes : (LANES as readonly Lane[]).slice(0, teamSize);
		history.pushHistory(assignment);
		setAssignment(autoAssignByPreference(detail.participants, lanes));
		selection.clearSelected();
	}, [detail, perms.canEdit, activeLanes, teamSize, assignment, history, selection.clearSelected]);

	// 코인토스 — BLUE 사이드 결정. TEAM_2 선택 시 swap 수행 (결과적으로 1팀 = 원래 2팀 = BLUE).
	const setCoinTossWinner = useCallback(
		(winnerTeam: "TEAM_1" | "TEAM_2") => {
			if (!perms.canEdit) return;
			if (winnerTeam === "TEAM_2") {
				history.pushHistory(assignment);
				setAssignment((prev) => swapAssignmentTeams(prev));
			}
			setCoinTossDecided(true);
			selection.clearSelected();
		},
		[perms.canEdit, assignment, history, selection.clearSelected],
	);
	const clearCoinToss = useCallback(() => setCoinTossDecided(false), []);

	useEntryUndoShortcuts({
		canEdit: perms.canEdit,
		undo: history.undo,
		redo: history.redo,
	});

	return {
		detail,
		assignment,
		error,
		saveStatus,
		savedAt,
		retrySave,
		submitting,
		submitError,
		submit,
		teamSize,
		activeLanes,
		unassigned,
		allFilled,
		recentlyChanged,
		selectedUid: selection.selectedUid,
		clearSelected: selection.clearSelected,
		moveTo: moveToWithHistory,
		swapTeams: swapTeamsWithHistory,
		handleParticipantTap: selection.handleParticipantTap,
		handleSlotTap: selection.handleSlotTap,
		handlePoolTap: selection.handlePoolTap,
		refresh: swr.refresh,
		autoAssign,
		undo: history.undo,
		redo: history.redo,
		canUndo: history.canUndo,
		canRedo: history.canRedo,
		coinTossDecided,
		setCoinTossWinner,
		clearCoinToss,
	};
}
