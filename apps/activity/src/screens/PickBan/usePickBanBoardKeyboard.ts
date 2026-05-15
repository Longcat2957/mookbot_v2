import { useEffect } from "react";
import type { ActiveSlot, Champion, ChampionPlay, GameDraft, Team } from "./types.js";
import { allSlots, sameSlot } from "./types.js";

interface Params {
	canEdit: boolean;
	activeSlot: ActiveSlot | null;
	search: string;
	searchRef: React.RefObject<HTMLInputElement | null>;
	teamSize: number;
	gameDraft: GameDraft;
	mains: ChampionPlay[];
	usable: Champion[];
	setSearch: (value: string) => void;
	setActiveSlot: (slot: ActiveSlot | null) => void;
	setSlot: (championId: number | null) => void;
	commitChampion: (championId: number) => void;
}

export function usePickBanBoardKeyboard({
	canEdit,
	activeSlot,
	search,
	searchRef,
	teamSize,
	gameDraft,
	mains,
	usable,
	setSearch,
	setActiveSlot,
	setSlot,
	commitChampion,
}: Params) {
	useEffect(() => {
		if (!activeSlot) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			if (document.activeElement === searchRef.current && search) {
				setSearch("");
				return;
			}
			setActiveSlot(null);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [activeSlot, search, searchRef, setActiveSlot, setSearch]);

	useEffect(() => {
		if (activeSlot && canEdit) searchRef.current?.focus();
	}, [activeSlot, canEdit, searchRef]);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== "/") return;
			const tag = (document.activeElement as HTMLElement | null)?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA") return;
			event.preventDefault();
			searchRef.current?.focus();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [searchRef]);

	useEffect(() => {
		if (!canEdit) return;
		const onKey = (event: KeyboardEvent) => {
			if (event.isComposing || !activeSlot) return;
			const tag = (document.activeElement as HTMLElement | null)?.tagName;
			const isInInput = tag === "INPUT" || tag === "TEXTAREA";
			const isInSearch = document.activeElement === searchRef.current;

			if (event.key === "Tab") {
				event.preventDefault();
				const slots = allSlots(teamSize);
				const index = slots.findIndex((slot) => sameSlot(slot, activeSlot));
				const dir = event.shiftKey ? -1 : 1;
				setActiveSlot(slots[(index + dir + slots.length) % slots.length] ?? null);
				return;
			}

			if (event.key === "Enter" && isInSearch) {
				const first: ChampionPlay | Champion | undefined = mains[0] ?? usable[0];
				if (!first) return;
				event.preventDefault();
				commitChampion("championId" in first ? first.championId : first.id);
				return;
			}

			if (event.key === "Backspace") {
				const arr =
					activeSlot.kind === "ban"
						? gameDraft.bans[activeSlot.team as Team]
						: gameDraft.picks[activeSlot.team as Team];
				if (arr[activeSlot.idx] == null) return;
				if (isInSearch && search) return;
				if (!isInInput || isInSearch) {
					event.preventDefault();
					setSlot(null);
				}
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [
		activeSlot,
		canEdit,
		commitChampion,
		gameDraft,
		mains,
		search,
		searchRef,
		setActiveSlot,
		setSlot,
		teamSize,
		usable,
	]);
}
