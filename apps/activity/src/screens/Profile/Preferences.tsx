// 프로필 — 라인별 선호 챔프 풀.
// 본인은 "+ 편집" 모달로 챔프 그리드에서 선택/해제. 다른 사용자 페이지는 read-only.
//
// 게시판 텍스트 풀이 (탑- 제이스, 케넨, 아칼리…) 의 페이지 대체.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api/rest.js";
import { showToast } from "../../components/Toaster.js";
import { useStaleWhileRevalidate } from "../../state/useStaleWhileRevalidate.js";
import { ChampCell } from "../PickBan/ChampCell.js";
import type { Champion } from "../PickBan/types.js";

const ROLES = ["TOP", "JUNGLE", "MID", "BOTTOM", "SUPPORT"] as const;
type Role = (typeof ROLES)[number];

const ROLE_LABEL: Record<Role, string> = {
	TOP: "탑",
	JUNGLE: "정글",
	MID: "미드",
	BOTTOM: "원딜",
	SUPPORT: "서폿",
};

interface PreferenceChamp {
	championId: number;
	championName: string;
	iconUrl: string;
}

interface PreferencesResponse {
	user: { discordId: string; displayName: string };
	maxPerRole: number;
	preferences: Record<Role, PreferenceChamp[]>;
}

export function Preferences({ userId, isMe }: { userId: string; isMe: boolean }) {
	const fetcher = useCallback(
		() => api<PreferencesResponse>(`/users/${userId}/preferences`),
		[userId],
	);
	const swr = useStaleWhileRevalidate<PreferencesResponse>(`prefs:${userId}`, fetcher, {
		debounceMs: 150,
	});
	const data = swr.data;
	const [editingRole, setEditingRole] = useState<Role | null>(null);

	if (swr.error) {
		return (
			<div className="alert alert-error">
				<span>선호 챔프를 불러오지 못했습니다: {swr.error}</span>
			</div>
		);
	}

	const isEmpty = data !== null && ROLES.every((r) => (data.preferences[r] ?? []).length === 0);

	return (
		<>
			<div className="space-y-2">
				{!data ? (
					<div className="skeleton h-24 w-full" />
				) : isEmpty && !isMe ? (
					<div className="text-sm text-base-content/50 py-2">등록된 선호 챔프가 없습니다.</div>
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
						{ROLES.map((role) => (
							<LaneRow
								key={role}
								role={role}
								champs={data.preferences[role] ?? []}
								isMe={isMe}
								onEdit={() => setEditingRole(role)}
							/>
						))}
					</div>
				)}
				{isMe && isEmpty && data && (
					<div className="text-xs text-base-content/60 px-1">
						💡 라인별 즐겨하는 챔프를 등록하면 다른 사람에게도 보입니다.
					</div>
				)}
			</div>

			{isMe && editingRole && data && (
				<EditModal
					role={editingRole}
					initial={data.preferences[editingRole] ?? []}
					maxPerRole={data.maxPerRole}
					onClose={() => setEditingRole(null)}
					onSaved={() => {
						setEditingRole(null);
						swr.refresh();
						showToast("선호 챔프가 저장되었습니다");
					}}
				/>
			)}
		</>
	);
}

function LaneRow({
	role,
	champs,
	isMe,
	onEdit,
}: {
	role: Role;
	champs: PreferenceChamp[];
	isMe: boolean;
	onEdit: () => void;
}) {
	return (
		<div className="rounded-lg border border-base-300 bg-base-100 p-2.5">
			<div className="flex items-center justify-between mb-1.5">
				<div className="text-[10px] uppercase tracking-wide text-base-content/60">
					{ROLE_LABEL[role]}
				</div>
				{isMe && (
					<button
						type="button"
						onClick={onEdit}
						className="btn btn-ghost btn-xs px-1.5 min-h-0 h-6"
						aria-label={`${ROLE_LABEL[role]} 선호 챔프 편집`}
					>
						✎ 편집
					</button>
				)}
			</div>
			{champs.length === 0 ? (
				<div className="text-xs text-base-content/40 py-1">—</div>
			) : (
				<div className="flex flex-wrap gap-1">
					{champs.map((c) => (
						<div
							key={c.championId}
							className="flex items-center gap-1 bg-base-200/60 rounded px-1 py-0.5"
							title={c.championName}
						>
							<img src={c.iconUrl} alt={c.championName} className="w-5 h-5 rounded" loading="lazy" />
							<span className="text-xs">{c.championName}</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function EditModal({
	role,
	initial,
	maxPerRole,
	onClose,
	onSaved,
}: {
	role: Role;
	initial: PreferenceChamp[];
	maxPerRole: number;
	onClose: () => void;
	onSaved: () => void;
}) {
	const [selected, setSelected] = useState<number[]>(() => initial.map((c) => c.championId));
	const [search, setSearch] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const searchRef = useRef<HTMLInputElement | null>(null);

	const champFetcher = useCallback(
		() => api<{ champions: Champion[] }>("/champions").then((r) => r.champions),
		[],
	);
	const champSwr = useStaleWhileRevalidate<Champion[]>("champions", champFetcher);
	const champions = champSwr.data ?? [];
	const champById = useMemo(() => {
		const map = new Map<number, Champion>();
		for (const c of champions) map.set(c.id, c);
		return map;
	}, [champions]);

	useEffect(() => {
		searchRef.current?.focus();
	}, []);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				if (search) setSearch("");
				else if (!saving) onClose();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [search, saving, onClose]);

	const filtered = useMemo(() => {
		if (!search.trim()) return champions;
		const q = search.trim().toLowerCase();
		return champions.filter(
			(c) =>
				c.name.toLowerCase().includes(q) ||
				c.idSlug.toLowerCase().includes(q) ||
				c.name.replace(/\s+/g, "").toLowerCase().includes(q),
		);
	}, [champions, search]);

	const selectedSet = useMemo(() => new Set(selected), [selected]);
	const atLimit = selected.length >= maxPerRole;

	const toggle = (id: number) => {
		setError(null);
		setSelected((prev) => {
			if (prev.includes(id)) return prev.filter((x) => x !== id);
			if (prev.length >= maxPerRole) {
				setError(`라인당 최대 ${maxPerRole}개까지 등록할 수 있습니다.`);
				return prev;
			}
			return [...prev, id];
		});
	};

	const removeAt = (idx: number) => {
		setError(null);
		setSelected((prev) => prev.filter((_, i) => i !== idx));
	};

	const move = (idx: number, dir: -1 | 1) => {
		setSelected((prev) => {
			const j = idx + dir;
			if (j < 0 || j >= prev.length) return prev;
			const a = prev[idx];
			const b = prev[j];
			if (a === undefined || b === undefined) return prev;
			const next = [...prev];
			next[idx] = b;
			next[j] = a;
			return next;
		});
	};

	const save = async () => {
		setSaving(true);
		setError(null);
		try {
			await api("/users/me/preferences", {
				method: "PUT",
				body: JSON.stringify({ role, championIds: selected }),
			});
			onSaved();
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setSaving(false);
		}
	};

	return (
		<dialog className="modal modal-open">
			<div className="modal-box max-w-3xl">
				<div className="flex items-start justify-between gap-2 mb-3">
					<h3 className="font-bold text-lg">{ROLE_LABEL[role]} 선호 챔프 편집</h3>
					<button
						type="button"
						className="btn btn-ghost btn-sm"
						onClick={onClose}
						disabled={saving}
						aria-label="닫기"
					>
						✕
					</button>
				</div>

				{/* 선택된 챔프 — 순서대로 표시, 클릭/X 로 삭제, 화살표로 순서 변경 */}
				<div className="mb-3">
					<div className="flex items-center justify-between mb-1">
						<span className="text-xs text-base-content/60">선택된 챔프 (순서대로 저장됨)</span>
						<span
							className={`text-xs tabular-nums ${atLimit ? "text-warning font-semibold" : "text-base-content/60"}`}
						>
							{selected.length} / {maxPerRole}
						</span>
					</div>
					{selected.length === 0 ? (
						<div className="text-xs text-base-content/40 py-2 px-2">
							아직 선택된 챔프가 없습니다 — 아래 그리드에서 클릭하세요.
						</div>
					) : (
						<div className="flex flex-wrap gap-1.5 bg-base-200/40 rounded p-2">
							{selected.map((id, idx) => {
								const c = champById.get(id);
								return (
									<div
										key={id}
										className="flex items-center gap-1 bg-base-100 rounded pl-1 pr-0.5 py-0.5 border border-base-300"
									>
										{c?.iconUrl && (
											<img src={c.iconUrl} alt={c.name} className="w-5 h-5 rounded" loading="lazy" />
										)}
										<span className="text-xs">{c?.name ?? `#${id}`}</span>
										<button
											type="button"
											className="btn btn-ghost btn-xs min-h-0 h-5 px-1"
											onClick={() => move(idx, -1)}
											disabled={idx === 0}
											aria-label="앞으로"
											title="앞으로"
										>
											‹
										</button>
										<button
											type="button"
											className="btn btn-ghost btn-xs min-h-0 h-5 px-1"
											onClick={() => move(idx, 1)}
											disabled={idx === selected.length - 1}
											aria-label="뒤로"
											title="뒤로"
										>
											›
										</button>
										<button
											type="button"
											className="btn btn-ghost btn-xs min-h-0 h-5 px-1 text-error"
											onClick={() => removeAt(idx)}
											aria-label={`${c?.name ?? `#${id}`} 제거`}
											title="제거"
										>
											✕
										</button>
									</div>
								);
							})}
						</div>
					)}
				</div>

				{/* 검색 + 그리드 */}
				<div className="space-y-2">
					<div className="join w-full">
						<input
							ref={searchRef}
							type="text"
							placeholder="챔피언 검색… (한/영, Esc 로 초기화)"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="input input-bordered input-sm join-item flex-1"
						/>
						<button
							type="button"
							className="btn btn-sm btn-ghost join-item"
							onClick={() => setSearch("")}
							disabled={!search}
							aria-label="검색 초기화"
						>
							✕
						</button>
					</div>

					{champSwr.data === null ? (
						<div className="skeleton h-48 w-full" />
					) : filtered.length === 0 ? (
						<div className="text-center text-sm text-base-content/50 py-6">"{search}" 검색 결과 없음</div>
					) : (
						<div className="grid grid-cols-[repeat(auto-fill,minmax(60px,1fr))] gap-1.5 max-h-[300px] overflow-y-auto pr-1">
							{filtered.map((c) => {
								const picked = selectedSet.has(c.id);
								return (
									<div key={c.id} className={picked ? "ring-2 ring-primary rounded-md" : ""}>
										<ChampCell
											champ={c}
											disabled={!picked && atLimit}
											reason={
												picked
													? `${c.name} — 클릭으로 제거`
													: atLimit
														? `최대 ${maxPerRole}개 한도 도달`
														: c.name
											}
											onClick={() => toggle(c.id)}
										/>
									</div>
								);
							})}
						</div>
					)}
				</div>

				{error && (
					<div className="alert alert-error alert-soft mt-3">
						<span>{error}</span>
					</div>
				)}

				<div className="modal-action">
					<button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
						취소
					</button>
					<button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
						{saving ? <span className="loading loading-spinner loading-sm" /> : "저장"}
					</button>
				</div>
			</div>
			<button
				type="button"
				className="modal-backdrop"
				onClick={() => {
					if (!saving) onClose();
				}}
				aria-label="모달 닫기"
			/>
		</dialog>
	);
}
