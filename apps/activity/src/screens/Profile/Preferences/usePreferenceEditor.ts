import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../../api/rest.js";
import { useChampionCatalog } from "../../../features/champions/useChampionCatalog.js";
import type { Champion } from "../../PickBan/types.js";
import type { PreferenceChamp, Role } from "./types.js";

export function usePreferenceEditor({
	initial,
	maxPerRole,
	onClose,
	onSaved,
	role,
}: {
	initial: PreferenceChamp[];
	maxPerRole: number;
	onClose: () => void;
	onSaved: () => void;
	role: Role;
}) {
	const [selected, setSelected] = useState<number[]>(() => initial.map((champ) => champ.championId));
	const [search, setSearch] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const searchRef = useRef<HTMLInputElement | null>(null);

	const champCatalog = useChampionCatalog<Champion>();
	const champions = champCatalog.champions;

	const champById = useMemo(() => {
		const map = new Map<number, Champion>();
		for (const champ of champions) map.set(champ.id, champ);
		return map;
	}, [champions]);

	useEffect(() => {
		searchRef.current?.focus();
	}, []);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return;
			if (search) setSearch("");
			else if (!saving) onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [search, saving, onClose]);

	const filtered = useMemo(() => {
		if (!search.trim()) return champions;
		const q = search.trim().toLowerCase();
		return champions.filter(
			(champ) =>
				champ.name.toLowerCase().includes(q) ||
				champ.idSlug.toLowerCase().includes(q) ||
				champ.name.replace(/\s+/g, "").toLowerCase().includes(q),
		);
	}, [champions, search]);

	const selectedSet = useMemo(() => new Set(selected), [selected]);
	const atLimit = selected.length >= maxPerRole;

	function toggle(id: number) {
		setError(null);
		setSelected((prev) => {
			if (prev.includes(id)) return prev.filter((value) => value !== id);
			if (prev.length >= maxPerRole) {
				setError(`라인당 최대 ${maxPerRole}개까지 등록할 수 있습니다.`);
				return prev;
			}
			return [...prev, id];
		});
	}

	function removeAt(idx: number) {
		setError(null);
		setSelected((prev) => prev.filter((_, index) => index !== idx));
	}

	function move(idx: number, dir: -1 | 1) {
		setSelected((prev) => {
			const nextIdx = idx + dir;
			if (nextIdx < 0 || nextIdx >= prev.length) return prev;
			const current = prev[idx];
			const target = prev[nextIdx];
			if (current === undefined || target === undefined) return prev;
			const next = [...prev];
			next[idx] = target;
			next[nextIdx] = current;
			return next;
		});
	}

	async function save() {
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
	}

	return {
		atLimit,
		champById,
		champSwr: {
			data: champCatalog.data,
			error: champCatalog.error,
			refresh: champCatalog.refresh,
			refreshing: champCatalog.refreshing,
		},
		error,
		filtered,
		removeAt,
		move,
		save,
		saving,
		search,
		searchRef,
		selected,
		selectedSet,
		setSearch,
		toggle,
	};
}
