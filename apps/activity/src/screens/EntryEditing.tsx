// [2] 엔트리 수정 — 드래그&드롭 슬롯 보드 (1팀 / 2팀).
// 후보 풀의 카드를 1팀 / 2팀 라인 슬롯으로 끌어다 놓아 엔트리 작성.
//
// 서브 컴포넌트 / types / 헬퍼는 ./EntryEditing/ 디렉토리로 분리. 이 파일은 orchestration 만.

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/rest.js";
import { wsClient } from "../api/ws.js";
import { type SaveStatus, SaveStatusIndicator } from "../components/SaveStatus.js";
import { showToast } from "../components/Toaster.js";
import { usePerms } from "../state/perms.js";
import { useStaleWhileRevalidate } from "../state/useStaleWhileRevalidate.js";
import { EntryEditingSkeleton } from "./EntryEditing/EntryEditingSkeleton.js";
import { ParticipantCard } from "./EntryEditing/ParticipantCard.js";
import { SlotRow } from "./EntryEditing/SlotRow.js";
import {
	type Assignment,
	LANES,
	type Lane,
	type RecruitmentDetail,
	type Slot,
	TEAM_LABEL,
	type Team,
} from "./EntryEditing/types.js";

export function EntryEditing({
	recruitmentId,
	onSubmit,
}: {
	recruitmentId: number | null;
	onSubmit: (seriesId: number) => void;
}) {
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
	// 관전 모드 — read-only alert dismissible (세션 단위). design_upgrade.md §6.7
	const dismissKey = recruitmentId !== null ? `readonly-dismissed-rec-${recruitmentId}` : "";
	const [readOnlyDismissed, setReadOnlyDismissed] = useState(false);
	useEffect(() => {
		if (!dismissKey) return;
		setReadOnlyDismissed(sessionStorage.getItem(dismissKey) === "1");
	}, [dismissKey]);
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

	// debounced 엔트리 draft 저장 — 본인이 만든 변경만 PUT
	const draftSaveTimer = useRef<number | null>(null);
	const lastSaved = useRef<string>("");

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
		if (recruitmentId === null || !perms.canEdit) return;
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
	}, [assignment, recruitmentId, perms.canEdit, retryNonce]);

	if (recruitmentId === null) {
		return (
			<div className="alert alert-warning">
				<span>모집을 먼저 선택해주세요. (좌측 상단 monkey 클릭 → 대시보드)</span>
			</div>
		);
	}
	if (error) {
		return (
			<div className="space-y-3">
				<div className="alert alert-error">
					<span>모집 정보를 불러오지 못했습니다: {error}</span>
				</div>
				<button type="button" className="btn btn-sm btn-outline" onClick={swr.refresh}>
					↻ 새로고침
				</button>
			</div>
		);
	}
	if (!detail) {
		return <EntryEditingSkeleton />;
	}

	const { recruitment, participants } = detail;
	const teamSize = recruitment.targetCount / 2;
	const activeLanes = LANES.slice(0, teamSize);
	const assignedSlots = new Set(assignment.values());
	const unassigned = participants.filter((p) => !assignment.has(p.userId));

	const moveTo = (userId: string, slot: Slot | null) => {
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
	};

	const allFilled = activeLanes.every(
		(l) => assignedSlots.has(`TEAM_1_${l}`) && assignedSlots.has(`TEAM_2_${l}`),
	);

	// 좌/우 swap — 1팀↔2팀 을 한 번에 뒤집어 시각 위치 변경. 1팀/2팀이
	// BLUE/RED 와 헷갈리는 상황에서 운영자가 직접 좌우를 조정할 수 있게 함.
	// role 은 그대로, team 만 토글. 빈 슬롯도 그대로 (Map 키 변경 없음).
	const swapTeams = () => {
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
	};

	// Tap-to-Place 핸들러
	const handleParticipantTap = (userId: string) => {
		if (!perms.canEdit) return;
		setSelectedUid((prev) => (prev === userId ? null : userId));
	};
	const handleSlotTap = (slot: Slot, occupantUserId: string | null) => {
		if (!perms.canEdit) return;
		if (selectedUid) {
			moveTo(selectedUid, slot);
			setSelectedUid(null);
		} else if (occupantUserId) {
			// 빈 selected → 슬롯의 사람을 selected (다른 곳으로 보내기 위해)
			setSelectedUid(occupantUserId);
		}
	};
	const handlePoolTap = () => {
		if (!perms.canEdit || !selectedUid) return;
		moveTo(selectedUid, null);
		setSelectedUid(null);
	};

	const submit = async () => {
		if (!allFilled || recruitmentId === null) return;
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
				body: JSON.stringify({ recruitmentId, assignments }),
			});
			onSubmit(res.seriesId);
		} catch (err) {
			setSubmitError(err instanceof Error ? err.message : String(err));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<section className="space-y-3">
			<header className="flex items-center justify-between flex-wrap gap-2">
				<div>
					<h2 className="text-xl font-bold flex items-center gap-3">
						엔트리 수정
						{perms.canEdit && (
							<SaveStatusIndicator
								status={saveStatus}
								savedAt={savedAt}
								onRetry={() => setRetryNonce((n) => n + 1)}
							/>
						)}
					</h2>
					<p className="text-xs text-base-content/70">
						모집 #{recruitment.id} · {teamSize}v{teamSize} · 후보 {participants.length}명{" · "}
						배정{" "}
						<span className="font-bold tabular-nums">
							{assignment.size}/{recruitment.targetCount}
						</span>
					</p>
				</div>
				<div className="join">
					<button
						className="btn btn-sm btn-ghost join-item"
						onClick={swr.refresh}
						title="새로고침"
						disabled={submitting}
					>
						↻
					</button>
					<button
						type="button"
						className="btn btn-sm btn-ghost join-item"
						onClick={swapTeams}
						title="1팀과 2팀의 좌/우 위치를 바꿉니다"
						aria-label="1팀과 2팀 좌우 바꾸기"
						disabled={submitting || !perms.canEdit || assignment.size === 0}
					>
						↔ 좌/우 바꾸기
					</button>
					{(() => {
						const submitTip = !perms.canEdit
							? "쓰기 권한이 없습니다 (읽기 전용)"
							: !allFilled
								? `모든 슬롯을 채워야 제출 가능합니다 (${assignment.size}/${recruitment.targetCount})`
								: undefined;
						const btn = (
							<button
								className="btn btn-sm btn-primary join-item"
								onClick={submit}
								disabled={!allFilled || submitting || !perms.canEdit}
							>
								{submitting ? (
									<>
										<span className="loading loading-spinner loading-xs" />
										제출 중…
									</>
								) : (
									"엔트리 제출"
								)}
							</button>
						);
						return submitTip ? (
							<span className="tooltip tooltip-bottom join-item" data-tip={submitTip}>
								{btn}
							</span>
						) : (
							btn
						);
					})()}
				</div>
			</header>

			{!perms.canEdit && !readOnlyDismissed && (
				<div className="alert alert-warning">
					<span>👁 관전 중 — 운영자 role 이 있어야 엔트리를 변경할 수 있습니다.</span>
					<button
						type="button"
						className="btn btn-ghost btn-xs"
						onClick={() => {
							if (dismissKey) sessionStorage.setItem(dismissKey, "1");
							setReadOnlyDismissed(true);
						}}
						aria-label="알림 닫기"
					>
						✕
					</button>
				</div>
			)}

			{submitError && (
				<div className="alert alert-error">
					<span>제출 실패: {submitError}</span>
				</div>
			)}

			{selectedUid &&
				(() => {
					const sel = participants.find((p) => p.userId === selectedUid);
					if (!sel) return null;
					const inSlot = assignment.has(selectedUid);
					return (
						<div className="alert alert-info alert-soft sticky top-2 z-10">
							<span>
								🎯 <strong>{sel.displayName}</strong> 선택됨 — {inSlot ? "다른 슬롯 또는 후보 풀" : "슬롯"}
								을 탭하여 배치
								<span className="text-xs opacity-70 ml-2">(Esc 취소)</span>
							</span>
							<button type="button" className="btn btn-xs btn-ghost" onClick={() => setSelectedUid(null)}>
								✕ 취소
							</button>
						</div>
					);
				})()}

			{/* 슬롯 보드 (1팀 / 2팀) */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
				{(["TEAM_1", "TEAM_2"] as const).map((team) => (
					<div
						key={team}
						className={`card bg-base-200 shadow-sm border-l-4 ${
							team === "TEAM_1" ? "border-info" : "border-error"
						}`}
					>
						<div className="card-body p-3 gap-2">
							<h3 className={`card-title text-base ${team === "TEAM_1" ? "text-info" : "text-error"}`}>
								{TEAM_LABEL[team]}
							</h3>
							<div className="space-y-1.5">
								{activeLanes.map((lane) => {
									const slot: Slot = `${team}_${lane}`;
									const assignedUserId = [...assignment.entries()].find(([, s]) => s === slot)?.[0];
									const assignedP = assignedUserId
										? participants.find((p) => p.userId === assignedUserId)
										: null;
									return (
										<SlotRow
											key={slot}
											lane={lane}
											participant={assignedP ?? null}
											onDrop={(uid) => moveTo(uid, slot)}
											onClear={() => assignedP && moveTo(assignedP.userId, null)}
											onTap={() => handleSlotTap(slot, assignedUserId ?? null)}
											selected={selectedUid !== null && assignedUserId === selectedUid}
											targetHint={selectedUid !== null && assignedUserId !== selectedUid}
											recentlyChanged={assignedUserId !== undefined && recentlyChanged.has(assignedUserId)}
										/>
									);
								})}
							</div>
						</div>
					</div>
				))}
			</div>

			{/* 후보 풀 — 컴팩트 가로 카드 */}
			<div
				className={`card bg-base-200 shadow-sm transition ${
					selectedUid !== null && assignment.has(selectedUid) ? "ring-2 ring-primary cursor-pointer" : ""
				}`}
				onDragOver={(e) => e.preventDefault()}
				onDrop={(e) => {
					const uid = e.dataTransfer.getData("text/plain");
					if (uid) moveTo(uid, null);
				}}
				onClick={(e) => {
					// 자식 카드 클릭은 자기 핸들러가 처리 — 여기는 풀 영역 빈 클릭만
					if (e.target === e.currentTarget && selectedUid && assignment.has(selectedUid)) {
						handlePoolTap();
					}
				}}
			>
				<div className="card-body p-3 gap-2">
					<div className="flex items-center justify-between flex-wrap gap-2">
						<h3 className="card-title text-base">
							후보 풀 · {unassigned.length}명 미배정 / 총 {participants.length}명
						</h3>
						<span className="text-xs text-base-content/50">탭하여 선택 → 슬롯 탭 (또는 드래그)</span>
					</div>
					{unassigned.length === 0 ? (
						<div className="text-center text-base-content/50 py-4 text-sm">
							모든 참가자가 슬롯에 배정되었습니다.
						</div>
					) : (
						<div
							className="grid grid-cols-1 md:grid-cols-2 gap-1.5"
							onClick={(e) => {
								if (e.target === e.currentTarget && selectedUid && assignment.has(selectedUid)) {
									handlePoolTap();
								}
							}}
						>
							{unassigned.map((p) => (
								<ParticipantCard
									key={p.userId}
									participant={p}
									selected={selectedUid === p.userId}
									onTap={() => handleParticipantTap(p.userId)}
									recentlyChanged={recentlyChanged.has(p.userId)}
								/>
							))}
						</div>
					)}
				</div>
			</div>
		</section>
	);
}
