// [2] 엔트리 수정 — 드래그&드롭 슬롯 보드 (1팀 / 2팀).
// 후보 풀의 카드를 1팀 / 2팀 라인 슬롯으로 끌어다 놓아 엔트리 작성.

import { useEffect, useRef, useState } from "react";
import { api } from "../api/rest.js";
import { wsClient } from "../api/ws.js";
import { usePerms } from "../state/perms.js";
import { SaveStatusIndicator, type SaveStatus } from "../components/SaveStatus.js";
import { showToast } from "../components/Toaster.js";

const LANES = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;
type Lane = (typeof LANES)[number];
type Team = "TEAM_1" | "TEAM_2";

const LANE_LABEL: Record<Lane, string> = {
	TOP: "탑",
	JUNGLE: "정글",
	MID: "미드",
	BOTTOM: "원딜",
	SUPPORT: "서폿",
};

const ROLE_LABEL: Record<string, string> = {
	TOP: "탑",
	JUNGLE: "정글",
	MID: "미드",
	BOTTOM: "원딜",
	SUPPORT: "서폿",
};

const TEAM_LABEL: Record<Team, string> = {
	TEAM_1: "1팀",
	TEAM_2: "2팀",
};

interface WL {
	plays: number;
	wins: number;
	losses: number;
}
interface ChampionPlay extends WL {
	championId: number;
	championName: string;
	iconUrl: string;
}
interface RolePlay extends WL {
	role: string;
}
interface PlayHistory {
	total: WL;
	topChampions: ChampionPlay[];
	rolePlays: RolePlay[];
	topRole: RolePlay | null;
}
interface Participant {
	userId: string;
	displayName: string;
	roles: string[];
	joinedAt: number;
	history: PlayHistory;
}
interface RecruitmentDetail {
	recruitment: {
		id: number;
		targetCount: number;
		status: string;
		createdBy: string;
		createdAt: number;
	};
	participants: Participant[];
	entryDraft: EntryDraft | null;
}

interface EntryDraft {
	// userId → "TEAM_1_TOP" / "TEAM_2_MID" 등 Slot
	assignments: Record<string, string>;
}

type Slot = `${Team}_${Lane}`;
type Assignment = Map<string, Slot>;

// ============================================================
// 메인 화면
// ============================================================

export function EntryEditing({
	recruitmentId,
	onSubmit,
}: {
	recruitmentId: number | null;
	onSubmit: (seriesId: number) => void;
}) {
	const [detail, setDetail] = useState<RecruitmentDetail | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [reloadKey, setReloadKey] = useState(0);
	const [assignment, setAssignment] = useState<Assignment>(new Map());
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	// Tap-to-Place 입력 — 모바일/터치 / 키보드 대안. design_upgrade.md §4.4.1
	const [selectedUid, setSelectedUid] = useState<string | null>(null);
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

	useEffect(() => {
		if (recruitmentId === null) return;
		let cancelled = false;
		setError(null);
		setDetail(null);
		api<RecruitmentDetail>(`/recruitments/${recruitmentId}`)
			.then((res) => {
				if (cancelled) return;
				setDetail(res);
				// 서버 draft 적용
				const next = new Map<string, Slot>();
				if (res.entryDraft?.assignments) {
					for (const [uid, slot] of Object.entries(res.entryDraft.assignments)) {
						next.set(uid, slot as Slot);
					}
				}
				setAssignment(next);
			})
			.catch((err: unknown) => {
				if (!cancelled) setError(err instanceof Error ? err.message : String(err));
			});
		return () => {
			cancelled = true;
		};
	}, [recruitmentId, reloadKey]);

	const refresh = () => setReloadKey((k) => k + 1);

	// recruitment topic 구독 — 다른 사용자가 멤버 관리 / 슬롯 배정 등으로 변경 시 자동 reload
	// (origin echo 는 wsClient 가 필터링)
	useEffect(() => {
		if (recruitmentId === null) return;
		return wsClient.subscribe(`recruitment:${recruitmentId}`, () => {
			refresh();
			showToast("다른 운영자가 엔트리를 수정했습니다");
		});
	}, [recruitmentId]);

	// debounced 엔트리 draft 저장 — 본인이 만든 변경만 PUT
	const draftSaveTimer = useRef<number | null>(null);
	const lastSaved = useRef<string>("");
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
				<span>모집을 먼저 선택해주세요. (좌측 상단 mookbot 클릭 → 대시보드)</span>
			</div>
		);
	}
	if (error) {
		return (
			<div className="space-y-3">
				<div className="alert alert-error">
					<span>모집 정보를 불러오지 못했습니다: {error}</span>
				</div>
				<button type="button" className="btn btn-sm btn-outline" onClick={refresh}>
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
						모집 #{recruitment.id} · {teamSize}v{teamSize} · 후보 {participants.length}명
						{" · "}
						배정 <span className="font-bold tabular-nums">
							{assignment.size}/{recruitment.targetCount}
						</span>
					</p>
				</div>
				<div className="join">
					<button
						className="btn btn-sm btn-ghost join-item"
						onClick={refresh}
						title="새로고침"
						disabled={submitting}
					>
						↻
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

			{!perms.canEdit && (
				<div className="alert alert-warning">
					<span>👁 읽기 전용 — 운영자 role 이 필요합니다. 엔트리 변경 불가.</span>
				</div>
			)}

			{submitError && (
				<div className="alert alert-error">
					<span>제출 실패: {submitError}</span>
				</div>
			)}

			{selectedUid && (() => {
				const sel = participants.find((p) => p.userId === selectedUid);
				if (!sel) return null;
				const inSlot = assignment.has(selectedUid);
				return (
					<div className="alert alert-info alert-soft sticky top-2 z-10">
						<span>
							🎯 <strong>{sel.displayName}</strong> 선택됨 —{" "}
							{inSlot ? "다른 슬롯 또는 후보 풀" : "슬롯"}을 탭하여 배치
							<span className="text-xs opacity-70 ml-2">(Esc 취소)</span>
						</span>
						<button
							type="button"
							className="btn btn-xs btn-ghost"
							onClick={() => setSelectedUid(null)}
						>
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
							<h3
								className={`card-title text-base ${
									team === "TEAM_1" ? "text-info" : "text-error"
								}`}
							>
								{TEAM_LABEL[team]}
							</h3>
							<div className="space-y-1.5">
								{activeLanes.map((lane) => {
									const slot: Slot = `${team}_${lane}`;
									const assignedUserId = [...assignment.entries()].find(
										([, s]) => s === slot,
									)?.[0];
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
					selectedUid !== null && assignment.has(selectedUid)
						? "ring-2 ring-primary cursor-pointer"
						: ""
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
						<span className="text-xs text-base-content/50">
							탭하여 선택 → 슬롯 탭 (또는 드래그)
						</span>
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
								/>
							))}
						</div>
					)}
				</div>
			</div>
		</section>
	);
}

// ============================================================
// 카드 — 드래그 가능, 자세한 전적 표시
// ============================================================

function ParticipantCard({
	participant,
	compact = false,
	selected = false,
	onTap,
}: {
	participant: Participant;
	compact?: boolean;
	selected?: boolean;
	onTap?: () => void;
}) {
	const { displayName, roles, history } = participant;
	const totalWr =
		history.total.plays > 0
			? Math.round((history.total.wins / history.total.plays) * 100)
			: 0;

	return (
		<div
			draggable
			role={onTap ? "button" : undefined}
			tabIndex={onTap ? 0 : undefined}
			onDragStart={(e) => {
				e.dataTransfer.setData("text/plain", participant.userId);
				e.dataTransfer.effectAllowed = "move";
			}}
			onClick={onTap}
			onKeyDown={(e) => {
				if (onTap && (e.key === "Enter" || e.key === " ")) {
					e.preventDefault();
					onTap();
				}
			}}
			className={`bg-base-300 rounded-lg cursor-grab active:cursor-grabbing hover:bg-base-content/10 transition px-3 py-2 flex items-center gap-2 min-w-0 ${
				selected ? "ring-2 ring-primary bg-primary/10" : ""
			}`}
		>
			{/* 좌: 이름 + 메타 */}
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2 mb-0.5">
					<span className="font-bold text-base truncate">{displayName}</span>
					{history.total.plays > 0 ? (
						<span
							className={`text-xs font-bold tabular-nums ${
								totalWr >= 50 ? "text-success" : "text-error"
							}`}
						>
							{totalWr}%
						</span>
					) : (
						<span className="badge badge-ghost badge-xs">신규</span>
					)}
					{history.total.plays > 0 && (
						<span className="text-[10px] opacity-50 tabular-nums">
							{history.total.wins}-{history.total.losses}
						</span>
					)}
				</div>
				<div className="flex items-center gap-1 flex-wrap">
					{roles.length > 0 && (
						<>
							{roles.map((r) => (
								<span key={r} className="badge badge-primary badge-xs">
									{ROLE_LABEL[r] ?? r}
								</span>
							))}
							<span className="opacity-30 mx-0.5">|</span>
						</>
					)}
					{history.topRole && history.topRole.plays > 0 && (
						<span className="badge badge-outline badge-xs">
							주 {ROLE_LABEL[history.topRole.role] ?? history.topRole.role}
						</span>
					)}
					{history.total.plays === 0 && (
						<span className="text-[10px] text-base-content/50 italic">전적 없음</span>
					)}
				</div>
			</div>

			{/* 우: 챔프 아이콘 5개 */}
			{history.topChampions.length > 0 && !compact && (
				<div className="flex gap-0.5 shrink-0">
					{history.topChampions.map((c) => (
						<ChampionTile key={c.championId} champ={c} />
					))}
				</div>
			)}
		</div>
	);
}

function ChampionTile({ champ }: { champ: ChampionPlay; compact?: boolean }) {
	const wr = champ.plays > 0 ? Math.round((champ.wins / champ.plays) * 100) : 0;
	return (
		<div
			className="tooltip tooltip-top"
			data-tip={`${champ.championName} · ${champ.plays}G ${champ.wins}승 ${champ.losses}패 (${wr}%)`}
		>
			<div className="relative">
				{champ.iconUrl ? (
					<img
						src={champ.iconUrl}
						alt={champ.championName}
						className="w-9 h-9 rounded border border-base-content/20"
						draggable={false}
					/>
				) : (
					<div className="w-9 h-9 rounded bg-base-content/10 flex items-center justify-center text-[10px]">
						?
					</div>
				)}
				<span
					className={`absolute -bottom-1 -right-1 text-[9px] font-bold rounded px-0.5 ${wrColor(
						wr,
					)} text-base-100`}
				>
					{wr}%
				</span>
			</div>
		</div>
	);
}

function wrColor(wr: number): string {
	if (wr >= 60) return "badge-success";
	if (wr >= 50) return "badge-info";
	if (wr >= 40) return "badge-warning";
	return "badge-error";
}

// ============================================================
// 슬롯 — 드롭 타겟
// ============================================================

function SlotRow({
	lane,
	participant,
	onDrop,
	onClear,
	onTap,
	selected = false,
	targetHint = false,
}: {
	lane: Lane;
	participant: Participant | null;
	onDrop: (userId: string) => void;
	onClear: () => void;
	onTap?: () => void;
	selected?: boolean;
	targetHint?: boolean;
}) {
	const [over, setOver] = useState(false);

	const baseRing = over
		? "ring-2 ring-primary bg-primary/10"
		: selected
			? "ring-2 ring-primary bg-primary/10"
			: targetHint && !participant
				? "ring-1 ring-primary/60 bg-primary/5"
				: targetHint
					? "ring-1 ring-warning/60"
					: "";

	return (
		<div
			role={onTap ? "button" : undefined}
			tabIndex={onTap ? 0 : undefined}
			onClick={(e) => {
				// inner ✕ button 클릭 시 슬롯 탭이 트리거되지 않도록 stop
				const target = e.target as HTMLElement;
				if (target.closest("button")) return;
				onTap?.();
			}}
			onKeyDown={(e) => {
				if (onTap && (e.key === "Enter" || e.key === " ")) {
					e.preventDefault();
					onTap();
				}
			}}
			onDragOver={(e) => {
				e.preventDefault();
				e.dataTransfer.dropEffect = "move";
				if (!over) setOver(true);
			}}
			onDragLeave={() => setOver(false)}
			onDrop={(e) => {
				e.preventDefault();
				setOver(false);
				const uid = e.dataTransfer.getData("text/plain");
				if (uid) onDrop(uid);
			}}
			className={`flex items-center gap-2 rounded-md transition ${baseRing}`}
		>
			<span className="badge badge-neutral min-w-[3.5rem] justify-center shrink-0 text-sm font-bold">
				{LANE_LABEL[lane]}
			</span>
			{participant ? (
				<div
					draggable
					onDragStart={(e) => {
						e.dataTransfer.setData("text/plain", participant.userId);
						e.dataTransfer.effectAllowed = "move";
					}}
					className="flex-1 min-w-0 bg-base-300 rounded-md px-2 py-1.5 cursor-grab active:cursor-grabbing hover:bg-base-content/10 transition flex items-center gap-1.5"
				>
					<span className="font-bold text-sm truncate flex-1">
						{participant.displayName}
					</span>
					{participant.history.topRole && (
						<span className="badge badge-outline badge-xs shrink-0">
							{ROLE_LABEL[participant.history.topRole.role] ?? participant.history.topRole.role}
						</span>
					)}
				</div>
			) : (
				<div className="flex-1 text-base-content/40 text-sm italic px-2 py-1.5 border border-dashed border-base-content/20 rounded-md text-center">
					— 비어있음 —
				</div>
			)}
			<button
				type="button"
				className="btn btn-error btn-xs shrink-0"
				onClick={onClear}
				disabled={!participant}
				title="슬롯 해제"
			>
				✕
			</button>
		</div>
	);
}

// ============================================================
// Skeleton — 로딩 상태
// ============================================================

function EntryEditingSkeleton() {
	return (
		<section className="space-y-3">
			<div className="flex items-center justify-between">
				<div className="space-y-2">
					<div className="skeleton h-7 w-40" />
					<div className="skeleton h-4 w-64" />
				</div>
				<div className="skeleton h-8 w-32" />
			</div>
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
				{[0, 1].map((i) => (
					<div key={i} className="card bg-base-200 shadow-sm">
						<div className="card-body p-4 gap-3">
							<div className="skeleton h-6 w-16" />
							{[0, 1, 2, 3, 4].map((j) => (
								<div key={j} className="skeleton h-12 w-full" />
							))}
						</div>
					</div>
				))}
			</div>
			<div className="card bg-base-200 shadow-sm">
				<div className="card-body p-4 space-y-3">
					<div className="skeleton h-5 w-32" />
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						{[0, 1, 2, 3].map((i) => (
							<div key={i} className="skeleton h-32 w-full" />
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
