// EntryEditing 화면의 상태 / SWR / 저장 / WS / Tap-to-Place / 액션 묶음.
// 화면 컴포넌트 (EntryEditing.tsx) 는 이 hook 의 반환값을 layout 에 wiring 만 함.

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../api/rest.js";
import { wsClient } from "../../api/ws.js";
import type { SaveStatus } from "../../components/SaveStatus.js";
import { showToast } from "../../components/Toaster.js";
import { usePerms } from "../../state/perms.js";
import { useStaleWhileRevalidate } from "../../state/useStaleWhileRevalidate.js";
import {
	type Assignment,
	LANES,
	type Lane,
	type Participant,
	type RecruitmentDetail,
	type Slot,
	type Team,
} from "./types.js";

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
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	// Tap-to-Place 입력 — 모바일/터치 / 키보드 대안. design_upgrade.md §4.4.1
	const [selectedUid, setSelectedUid] = useState<string | null>(null);
	// 다른 운영자 변경 시 1.5s ring pulse 로 위치 시각화 (hot_fix.md §3.6).
	const [recentlyChanged, setRecentlyChanged] = useState<Set<string>>(() => new Set());
	const recentClearTimer = useRef<number | null>(null);
	useEffect(
		() => () => {
			if (recentClearTimer.current) window.clearTimeout(recentClearTimer.current);
		},
		[],
	);
	const perms = usePerms();

	// Esc 키로 선택 해제
	useEffect(() => {
		if (!selectedUid) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setSelectedUid(null);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [selectedUid]);

	// debounced 엔트리 draft 저장 — 본인이 만든 변경만 PUT.
	// lastSaved 초기값을 "{}" 로 두는 이유: 빈 Map 직렬화와 매치시켜, 첫 fetch
	// 가 도착하기 전 빈 초기 state 가 "dirty" 로 오인되어 서버 draft 를 빈 객체로
	// 덮어쓰는 race 를 방지 (gate 는 아래 save effect 의 !detail 도 함께 처리).
	const draftSaveTimer = useRef<number | null>(null);
	const lastSaved = useRef<string>("{}");

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
			const incoming = new Map<string, Slot>();
			if (next.entryDraft?.assignments) {
				for (const [uid, slot] of Object.entries(next.entryDraft.assignments)) {
					incoming.set(uid, slot as Slot);
				}
			}
			const incomingSerialized = JSON.stringify(Object.fromEntries(incoming));
			if (prev === null) {
				// 첫 로드 — server draft 무조건 반영
				setAssignment(incoming);
				lastSaved.current = incomingSerialized;
				return;
			}
			// 변경된 user 추출 — incoming pulse 표시용 (적용 여부와 별개로 diff 는 항상 수집)
			const prevMap = new Map<string, Slot>();
			if (prev.entryDraft?.assignments) {
				for (const [uid, slot] of Object.entries(prev.entryDraft.assignments)) {
					prevMap.set(uid, slot as Slot);
				}
			}
			const changedUids = new Set<string>();
			for (const [uid, slot] of incoming) {
				if (prevMap.get(uid) !== slot) changedUids.add(uid);
			}
			for (const [uid, slot] of prevMap) {
				if (incoming.get(uid) !== slot) changedUids.add(uid);
			}
			if (changedUids.size > 0) {
				setRecentlyChanged(changedUids);
				if (recentClearTimer.current) window.clearTimeout(recentClearTimer.current);
				recentClearTimer.current = window.setTimeout(() => {
					setRecentlyChanged(new Set());
				}, 1500);
			}
			// 본인 dirty (lastSaved 와 다름) 면 incoming 무시 — 본인의 다음 PUT 이
			// last-write-wins 로 정렬됨. clean 이면 server 값으로 동기화.
			const localSerialized = JSON.stringify(Object.fromEntries(assignment));
			const isLocalDirty = localSerialized !== lastSaved.current;
			if (!isLocalDirty) {
				setAssignment(incoming);
				lastSaved.current = incomingSerialized;
			}
		},
	});
	const detail = swr.data;
	const error = swr.error;

	// recruitment topic 구독 — 다른 사용자 변경 시 background refresh (플리커 X).
	useEffect(() => {
		if (recruitmentId === null) return;
		return wsClient.subscribe(`recruitment:${recruitmentId}`, () => {
			swr.refresh();
			showToast("다른 운영자가 엔트리를 수정했습니다");
		});
	}, [recruitmentId, swr]);

	const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
	const [savedAt, setSavedAt] = useState<number | null>(null);
	const [retryNonce, setRetryNonce] = useState(0);
	useEffect(() => {
		// !detail 가드 — 첫 fetch 가 도착해 onApply 가 assignment / lastSaved 를
		// 서버 truth 로 채우기 전에는 절대 PUT 하지 않음. PickBan 의 !draft 가드와
		// 동일 의도 (빈 초기 state 가 서버 draft 를 덮어쓰는 race 차단).
		if (recruitmentId === null || !perms.canEdit || !detail) return;
		const serialized = JSON.stringify(Object.fromEntries(assignment));
		if (serialized === lastSaved.current) return;
		setSaveStatus("saving");
		if (draftSaveTimer.current) window.clearTimeout(draftSaveTimer.current);
		draftSaveTimer.current = window.setTimeout(() => {
			api(`/recruitments/${recruitmentId}/entry-draft`, {
				method: "PUT",
				body: JSON.stringify({ assignments: Object.fromEntries(assignment) }),
			})
				.then(() => {
					lastSaved.current = serialized;
					setSaveStatus("saved");
					setSavedAt(performance.now());
				})
				.catch((err) => {
					console.warn("[mookbot] entry-draft save failed", err);
					setSaveStatus("error");
				});
		}, 250);
		return () => {
			if (draftSaveTimer.current) window.clearTimeout(draftSaveTimer.current);
		};
	}, [assignment, recruitmentId, perms.canEdit, retryNonce, detail]);

	// derived
	const teamSize = detail ? detail.recruitment.targetCount / 2 : 0;
	const activeLanes = LANES.slice(0, teamSize) as Lane[];
	const assignedSlots = new Set(assignment.values());
	const unassigned = detail ? detail.participants.filter((p) => !assignment.has(p.userId)) : [];
	const allFilled =
		teamSize > 0 &&
		activeLanes.every((l) => assignedSlots.has(`TEAM_1_${l}`) && assignedSlots.has(`TEAM_2_${l}`));

	// 액션
	const moveTo = useCallback((userId: string, slot: Slot | null) => {
		setAssignment((prev) => {
			const next = new Map(prev);
			if (slot) {
				for (const [uid, s] of next) {
					if (s === slot && uid !== userId) {
						const cur = next.get(userId);
						if (cur) next.set(uid, cur);
						else next.delete(uid);
						break;
					}
				}
				next.set(userId, slot);
			} else {
				next.delete(userId);
			}
			return next;
		});
	}, []);

	// 좌/우 swap — 1팀↔2팀 을 한 번에 뒤집어 시각 위치 변경. 1팀/2팀이
	// BLUE/RED 와 헷갈리는 상황에서 운영자가 직접 좌우를 조정할 수 있게 함.
	// role 은 그대로, team 만 토글. 빈 슬롯도 그대로 (Map 키 변경 없음).
	const swapTeams = useCallback(() => {
		setAssignment((prev) => {
			const next = new Map<string, Slot>();
			for (const [uid, slot] of prev) {
				const lastUnderscore = slot.lastIndexOf("_");
				const team = slot.slice(0, lastUnderscore) as Team;
				const role = slot.slice(lastUnderscore + 1) as Lane;
				const flipped: Team = team === "TEAM_1" ? "TEAM_2" : "TEAM_1";
				next.set(uid, `${flipped}_${role}`);
			}
			return next;
		});
		setSelectedUid(null);
	}, []);

	const handleParticipantTap = useCallback(
		(userId: string) => {
			if (!perms.canEdit) return;
			setSelectedUid((prev) => (prev === userId ? null : userId));
		},
		[perms.canEdit],
	);

	const handleSlotTap = useCallback(
		(slot: Slot, occupantUserId: string | null) => {
			if (!perms.canEdit) return;
			if (selectedUid) {
				moveTo(selectedUid, slot);
				setSelectedUid(null);
			} else if (occupantUserId) {
				// 빈 selected → 슬롯의 사람을 selected (다른 곳으로 보내기 위해)
				setSelectedUid(occupantUserId);
			}
		},
		[perms.canEdit, selectedUid, moveTo],
	);

	const handlePoolTap = useCallback(() => {
		if (!perms.canEdit || !selectedUid) return;
		moveTo(selectedUid, null);
		setSelectedUid(null);
	}, [perms.canEdit, selectedUid, moveTo]);

	// 코인토스 — BLUE 사이드 결정 여부. 결정 시 항상 "1팀 = BLUE" 가 되도록 swap 자동.
	const [coinTossDecided, setCoinTossDecided] = useState(false);

	const submit = useCallback(async (): Promise<{ seriesId: number } | null> => {
		if (!allFilled || recruitmentId === null) return null;
		setSubmitting(true);
		setSubmitError(null);
		try {
			const assignments = [...assignment.entries()].map(([userId, slot]) => {
				// Slot 포맷: "TEAM_1_TOP" / "TEAM_2_MID" — 마지막 _ 기준으로 분리
				const lastUnderscore = slot.lastIndexOf("_");
				const team = slot.slice(0, lastUnderscore) as Team;
				const role = slot.slice(lastUnderscore + 1) as Lane;
				return { userId, team, role };
			});
			const res = await api<{ seriesId: number }>("/series", {
				method: "POST",
				body: JSON.stringify({
					recruitmentId,
					assignments,
					...(coinTossDecided ? { team1Side: "BLUE" as const } : {}),
				}),
			});
			return res;
		} catch (err) {
			setSubmitError(err instanceof Error ? err.message : String(err));
			return null;
		} finally {
			setSubmitting(false);
		}
	}, [allFilled, assignment, recruitmentId, coinTossDecided]);

	const retrySave = useCallback(() => setRetryNonce((n) => n + 1), []);
	const clearSelected = useCallback(() => setSelectedUid(null), []);

	// W5 — Undo/Redo (메모리 only, depth 20). 본인 변경 (moveTo/swapTeams/autoAssign) 만 push.
	const HISTORY_MAX = 20;
	const [history, setHistory] = useState<Assignment[]>([new Map()]);
	const [historyIdx, setHistoryIdx] = useState(0);
	// 변경 직전 snapshot push — historyIdx 이후 잘라내고 새 변경 추가.
	const pushHistory = useCallback(
		(snapshot: Assignment) => {
			setHistory((prev) => {
				const truncated = prev.slice(0, Math.max(1, historyIdx + 1));
				const next = [...truncated, new Map(snapshot)];
				return next.length > HISTORY_MAX ? next.slice(-HISTORY_MAX) : next;
			});
			setHistoryIdx((prev) => Math.min(prev + 1, HISTORY_MAX - 1));
		},
		[historyIdx],
	);

	// 기존 moveTo / swapTeams 호출 직전에 pushHistory 추가. 새 함수 wrap.
	const moveToWithHistory = useCallback(
		(userId: string, slot: Slot | null) => {
			pushHistory(assignment);
			moveTo(userId, slot);
		},
		[pushHistory, assignment, moveTo],
	);
	const swapTeamsWithHistory = useCallback(() => {
		pushHistory(assignment);
		swapTeams();
	}, [pushHistory, assignment, swapTeams]);

	// W5 — 자동 배치 (client-side, participant.roles[]/history.topRole 기반 + 셔플).
	const autoAssign = useCallback(() => {
		if (!detail || !perms.canEdit) return;
		const lanes =
			activeLanes.length > 0 ? activeLanes : (LANES as readonly Lane[]).slice(0, teamSize);
		const remaining = [...detail.participants];
		for (let i = remaining.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			const ri = remaining[i] as Participant;
			const rj = remaining[j] as Participant;
			remaining[i] = rj;
			remaining[j] = ri;
		}
		const slots: Slot[] = [];
		for (const team of ["TEAM_1", "TEAM_2"] as const) {
			for (const lane of lanes) slots.push(`${team}_${lane}` as Slot);
		}
		const next: Assignment = new Map();
		for (const slot of slots) {
			if (remaining.length === 0) break;
			const lane = slot.slice(slot.lastIndexOf("_") + 1) as Lane;
			let idx = remaining.findIndex((p) => p.roles.includes(lane));
			if (idx < 0) idx = remaining.findIndex((p) => p.history.topRole?.role === lane);
			if (idx < 0) idx = 0;
			const picked = remaining[idx];
			if (!picked) break;
			next.set(picked.userId, slot);
			remaining.splice(idx, 1);
		}
		pushHistory(assignment);
		setAssignment(next);
		setSelectedUid(null);
	}, [detail, perms.canEdit, activeLanes, teamSize, assignment, pushHistory]);

	const undo = useCallback(() => {
		if (historyIdx <= 0) return;
		const newIdx = historyIdx - 1;
		const snap = history[newIdx];
		if (!snap) return;
		setHistoryIdx(newIdx);
		setAssignment(new Map(snap));
		setSelectedUid(null);
	}, [history, historyIdx]);

	const redo = useCallback(() => {
		if (historyIdx >= history.length - 1) return;
		const newIdx = historyIdx + 1;
		const snap = history[newIdx];
		if (!snap) return;
		setHistoryIdx(newIdx);
		setAssignment(new Map(snap));
		setSelectedUid(null);
	}, [history, historyIdx]);

	const canUndo = historyIdx > 0;
	const canRedo = historyIdx < history.length - 1;

	// 코인토스 — BLUE 사이드 결정. TEAM_2 선택 시 swap 수행 (결과적으로 1팀 = 원래 2팀 = BLUE).
	const setCoinTossWinner = useCallback(
		(winnerTeam: "TEAM_1" | "TEAM_2") => {
			if (!perms.canEdit) return;
			if (winnerTeam === "TEAM_2") {
				pushHistory(assignment);
				setAssignment((prev) => {
					const next = new Map<string, Slot>();
					for (const [uid, slot] of prev) {
						const lastUnderscore = slot.lastIndexOf("_");
						const team = slot.slice(0, lastUnderscore) as Team;
						const role = slot.slice(lastUnderscore + 1) as Lane;
						const flipped: Team = team === "TEAM_1" ? "TEAM_2" : "TEAM_1";
						next.set(uid, `${flipped}_${role}`);
					}
					return next;
				});
			}
			setCoinTossDecided(true);
			setSelectedUid(null);
		},
		[perms.canEdit, assignment, pushHistory],
	);
	const clearCoinToss = useCallback(() => setCoinTossDecided(false), []);

	// Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y 단축키 — IME compositionend 후만 발동.
	// SoT: state/shortcuts.ts — HelpModal 이 표시하는 단축키 목록과 sync.
	useEffect(() => {
		if (!perms.canEdit) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.isComposing) return;
			if (!e.ctrlKey) return;
			if ((e.key === "z" || e.key === "Z") && !e.shiftKey) {
				e.preventDefault();
				undo();
			} else if ((e.key === "z" || e.key === "Z") && e.shiftKey) {
				e.preventDefault();
				redo();
			} else if (e.key === "y" || e.key === "Y") {
				e.preventDefault();
				redo();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [perms.canEdit, undo, redo]);

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
		selectedUid,
		clearSelected,
		moveTo: moveToWithHistory,
		swapTeams: swapTeamsWithHistory,
		handleParticipantTap,
		handleSlotTap,
		handlePoolTap,
		refresh: swr.refresh,
		autoAssign,
		undo,
		redo,
		canUndo,
		canRedo,
		coinTossDecided,
		setCoinTossWinner,
		clearCoinToss,
	};
}
