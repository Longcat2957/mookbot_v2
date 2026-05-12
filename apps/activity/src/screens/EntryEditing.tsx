// [2] 엔트리 수정 — 드래그&드롭 슬롯 보드 (1팀 / 2팀).
// 후보 풀의 카드를 1팀 / 2팀 라인 슬롯으로 끌어다 놓아 엔트리 작성.
//
// 상태 / SWR / 저장 / WS / Tap-to-Place / 액션 은 ./EntryEditing/useEntryEditingState.ts 에 응집.
// 이 파일은 layout + props wiring 만.

import { useEffect, useState } from "react";
import { SaveStatusIndicator } from "../components/SaveStatus.js";
import { usePerms } from "../state/perms.js";
import { EntryEditingSkeleton } from "./EntryEditing/EntryEditingSkeleton.js";
import { ParticipantCard } from "./EntryEditing/ParticipantCard.js";
import { SlotRow } from "./EntryEditing/SlotRow.js";
import { type Slot, TEAM_LABEL } from "./EntryEditing/types.js";
import { useEntryEditingState } from "./EntryEditing/useEntryEditingState.js";

export function EntryEditing({
	recruitmentId,
	onSubmit,
}: {
	recruitmentId: number | null;
	onSubmit: (seriesId: number) => void;
}) {
	const perms = usePerms();
	const s = useEntryEditingState({ recruitmentId });

	// 관전 모드 — read-only alert dismissible (세션 단위). design_upgrade.md §6.7
	const dismissKey = recruitmentId !== null ? `readonly-dismissed-rec-${recruitmentId}` : "";
	const [readOnlyDismissed, setReadOnlyDismissed] = useState(false);
	useEffect(() => {
		if (!dismissKey) return;
		setReadOnlyDismissed(sessionStorage.getItem(dismissKey) === "1");
	}, [dismissKey]);

	if (recruitmentId === null) {
		return (
			<div className="alert alert-warning">
				<span>모집을 먼저 선택해주세요. (좌측 상단 monkey 클릭 → 대시보드)</span>
			</div>
		);
	}
	if (s.error) {
		return (
			<div className="space-y-3">
				<div className="alert alert-error">
					<span>모집 정보를 불러오지 못했습니다: {s.error}</span>
				</div>
				<button type="button" className="btn btn-sm btn-outline" onClick={s.refresh}>
					↻ 새로고침
				</button>
			</div>
		);
	}
	if (!s.detail) {
		return <EntryEditingSkeleton />;
	}

	const { recruitment, participants } = s.detail;

	const handleSubmit = async () => {
		const res = await s.submit();
		if (res) onSubmit(res.seriesId);
	};

	return (
		<section className="space-y-3">
			<header className="flex items-center justify-between flex-wrap gap-2">
				<div>
					<h2 className="text-xl font-bold flex items-center gap-3">
						엔트리 수정
						{perms.canEdit && (
							<SaveStatusIndicator status={s.saveStatus} savedAt={s.savedAt} onRetry={s.retrySave} />
						)}
					</h2>
					<p className="text-xs text-base-content/70">
						모집 #{recruitment.id} · {s.teamSize}v{s.teamSize} · 후보 {participants.length}명{" · "}
						배정{" "}
						<span className="font-bold tabular-nums">
							{s.assignment.size}/{recruitment.targetCount}
						</span>
					</p>
				</div>
				<div className="join">
					<button
						className="btn btn-sm btn-ghost join-item"
						onClick={s.refresh}
						title="새로고침"
						disabled={s.submitting}
					>
						↻
					</button>
					<button
						type="button"
						className="btn btn-sm btn-ghost join-item"
						onClick={s.swapTeams}
						title="1팀과 2팀의 좌/우 위치를 바꿉니다"
						aria-label="1팀과 2팀 좌우 바꾸기"
						disabled={s.submitting || !perms.canEdit || s.assignment.size === 0}
					>
						↔ 좌/우 바꾸기
					</button>
					{(() => {
						const submitTip = !perms.canEdit
							? "쓰기 권한이 없습니다 (읽기 전용)"
							: !s.allFilled
								? `모든 슬롯을 채워야 제출 가능합니다 (${s.assignment.size}/${recruitment.targetCount})`
								: undefined;
						const btn = (
							<button
								className="btn btn-sm btn-primary join-item"
								onClick={handleSubmit}
								disabled={!s.allFilled || s.submitting || !perms.canEdit}
							>
								{s.submitting ? (
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

			{s.submitError && (
				<div className="alert alert-error">
					<span>제출 실패: {s.submitError}</span>
				</div>
			)}

			{s.selectedUid &&
				(() => {
					const sel = participants.find((p) => p.userId === s.selectedUid);
					if (!sel) return null;
					const inSlot = s.assignment.has(s.selectedUid);
					return (
						<div className="alert alert-info alert-soft sticky top-2 z-10">
							<span>
								🎯 <strong>{sel.displayName}</strong> 선택됨 — {inSlot ? "다른 슬롯 또는 후보 풀" : "슬롯"}
								을 탭하여 배치
								<span className="text-xs opacity-70 ml-2">(Esc 취소)</span>
							</span>
							<button type="button" className="btn btn-xs btn-ghost" onClick={s.clearSelected}>
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
								{s.activeLanes.map((lane) => {
									const slot: Slot = `${team}_${lane}`;
									const assignedUserId = [...s.assignment.entries()].find(([, sl]) => sl === slot)?.[0];
									const assignedP = assignedUserId
										? participants.find((p) => p.userId === assignedUserId)
										: null;
									return (
										<SlotRow
											key={slot}
											lane={lane}
											participant={assignedP ?? null}
											onDrop={(uid) => s.moveTo(uid, slot)}
											onClear={() => assignedP && s.moveTo(assignedP.userId, null)}
											onTap={() => s.handleSlotTap(slot, assignedUserId ?? null)}
											selected={s.selectedUid !== null && assignedUserId === s.selectedUid}
											targetHint={s.selectedUid !== null && assignedUserId !== s.selectedUid}
											recentlyChanged={assignedUserId !== undefined && s.recentlyChanged.has(assignedUserId)}
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
					s.selectedUid !== null && s.assignment.has(s.selectedUid)
						? "ring-2 ring-primary cursor-pointer"
						: ""
				}`}
				onDragOver={(e) => e.preventDefault()}
				onDrop={(e) => {
					const uid = e.dataTransfer.getData("text/plain");
					if (uid) s.moveTo(uid, null);
				}}
				onClick={(e) => {
					// 자식 카드 클릭은 자기 핸들러가 처리 — 여기는 풀 영역 빈 클릭만
					if (e.target === e.currentTarget && s.selectedUid && s.assignment.has(s.selectedUid)) {
						s.handlePoolTap();
					}
				}}
			>
				<div className="card-body p-3 gap-2">
					<div className="flex items-center justify-between flex-wrap gap-2">
						<h3 className="card-title text-base">
							후보 풀 · {s.unassigned.length}명 미배정 / 총 {participants.length}명
						</h3>
						<span className="text-xs text-base-content/50">탭하여 선택 → 슬롯 탭 (또는 드래그)</span>
					</div>
					{s.unassigned.length === 0 ? (
						<div className="text-center text-base-content/50 py-4 text-sm">
							모든 참가자가 슬롯에 배정되었습니다.
						</div>
					) : (
						<div
							className="grid grid-cols-1 md:grid-cols-2 gap-1.5"
							onClick={(e) => {
								if (e.target === e.currentTarget && s.selectedUid && s.assignment.has(s.selectedUid)) {
									s.handlePoolTap();
								}
							}}
						>
							{s.unassigned.map((p) => (
								<ParticipantCard
									key={p.userId}
									participant={p}
									selected={s.selectedUid === p.userId}
									onTap={() => s.handleParticipantTap(p.userId)}
									recentlyChanged={s.recentlyChanged.has(p.userId)}
								/>
							))}
						</div>
					)}
				</div>
			</div>
		</section>
	);
}
