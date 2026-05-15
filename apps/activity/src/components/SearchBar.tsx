import { useEffect, useRef, useState } from "react";
import { SearchDropdown } from "./SearchBar/SearchDropdown.js";
import type { SearchHit } from "./SearchBar/types.js";
import { useUserSearch } from "./SearchBar/useUserSearch.js";

export function SearchBar({ onSelectUser }: { onSelectUser: (userId: string) => void }) {
	const [query, setQuery] = useState("");
	const [open, setOpen] = useState(false);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const { hits, loading, activeIdx, setActiveIdx, clearHits } = useUserSearch(query);

	// "/" 단축키 — input focus (다른 INPUT/TEXTAREA 안에 있지 않을 때)
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "/") return;
			const tag = (document.activeElement as HTMLElement | null)?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA") return;
			e.preventDefault();
			inputRef.current?.focus();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	// 외부 클릭 시 닫기
	useEffect(() => {
		const onPointer = (e: PointerEvent) => {
			if (!containerRef.current) return;
			if (!containerRef.current.contains(e.target as Node)) setOpen(false);
		};
		window.addEventListener("pointerdown", onPointer);
		return () => window.removeEventListener("pointerdown", onPointer);
	}, []);

	const select = (hit: SearchHit) => {
		onSelectUser(hit.discordId);
		setOpen(false);
		setQuery("");
		clearHits();
		inputRef.current?.blur();
	};

	const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Escape") {
			if (query) {
				setQuery("");
				clearHits();
			} else {
				setOpen(false);
				inputRef.current?.blur();
			}
			return;
		}
		if (!open || hits.length === 0) return;
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActiveIdx((i) => Math.min(hits.length - 1, i + 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setActiveIdx((i) => Math.max(0, i - 1));
		} else if (e.key === "Enter") {
			e.preventDefault();
			const hit = hits[activeIdx];
			if (hit) select(hit);
		}
	};

	const showDropdown = open && (loading || hits.length > 0 || query.trim().length > 0);

	return (
		<div ref={containerRef} className="relative w-full max-w-md">
			<input
				ref={inputRef}
				type="search"
				value={query}
				onChange={(e) => {
					setQuery(e.target.value);
					setOpen(true);
				}}
				onFocus={() => setOpen(true)}
				onKeyDown={onKeyDown}
				placeholder="사용자 검색… ( / )"
				className="input input-sm input-bordered w-full"
				aria-label="사용자 검색"
			/>
			{showDropdown && (
				<SearchDropdown
					query={query}
					hits={hits}
					loading={loading}
					activeIdx={activeIdx}
					onSelect={select}
					onHover={setActiveIdx}
				/>
			)}
		</div>
	);
}
