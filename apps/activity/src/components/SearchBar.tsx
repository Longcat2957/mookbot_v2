// Navbar 사용자 검색 — op.gg/fow.kr 스타일.
// Discord display_name + 메인 Riot game_name 부분일치 → 결과 드롭다운.
// 키보드: ↑↓ 네비, Enter 선택, Esc 클리어/닫기. "/" 단축키로 input focus.

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/rest.js";
import { UserAvatar } from "./UserAvatar.js";

interface SearchHit {
	discordId: string;
	displayName: string;
	profileIconUrl: string | null;
	mainAccount: { gameName: string; tagLine: string } | null;
	topChampion: {
		championId: number;
		championName: string;
		iconUrl: string;
		splashUrl: string;
	} | null;
}

interface SearchResponse {
	query: string;
	users: SearchHit[];
}

const DEBOUNCE_MS = 200;

export function SearchBar({ onSelectUser }: { onSelectUser: (userId: string) => void }) {
	const [query, setQuery] = useState("");
	const [hits, setHits] = useState<SearchHit[]>([]);
	const [loading, setLoading] = useState(false);
	const [open, setOpen] = useState(false);
	const [activeIdx, setActiveIdx] = useState(0);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const debounceTimer = useRef<number | null>(null);
	const reqSeq = useRef(0);

	const runSearch = useCallback(async (q: string, seq: number) => {
		if (!q.trim()) {
			setHits([]);
			setLoading(false);
			return;
		}
		setLoading(true);
		try {
			const r = await api<SearchResponse>(`/users/search?q=${encodeURIComponent(q)}`);
			// stale 응답 무시 (사용자가 빠르게 타이핑한 경우)
			if (seq !== reqSeq.current) return;
			setHits(r.users);
			setActiveIdx(0);
		} catch (err) {
			if (seq !== reqSeq.current) return;
			console.warn("[mookbot] search failed", err);
			setHits([]);
		} finally {
			if (seq === reqSeq.current) setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (debounceTimer.current !== null) window.clearTimeout(debounceTimer.current);
		const seq = ++reqSeq.current;
		debounceTimer.current = window.setTimeout(() => {
			runSearch(query, seq);
		}, DEBOUNCE_MS);
		return () => {
			if (debounceTimer.current !== null) window.clearTimeout(debounceTimer.current);
		};
	}, [query, runSearch]);

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
		setHits([]);
		inputRef.current?.blur();
	};

	const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Escape") {
			if (query) {
				setQuery("");
				setHits([]);
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
				<div className="absolute top-full left-0 right-0 mt-1 z-30 bg-base-100 rounded-box shadow-lg border border-base-300 max-h-80 overflow-y-auto">
					{loading && hits.length === 0 ? (
						<div className="px-3 py-2 text-sm text-base-content/50">검색 중…</div>
					) : hits.length === 0 ? (
						<div className="px-3 py-2 text-sm text-base-content/50">
							{query.trim() ? `"${query}" 매칭 없음` : "닉네임을 입력하세요"}
						</div>
					) : (
						hits.map((h, i) => (
							<button
								key={h.discordId}
								type="button"
								onClick={() => select(h)}
								onMouseEnter={() => setActiveIdx(i)}
								className={`w-full text-left px-3 py-2 transition flex items-center gap-3 ${
									i === activeIdx ? "bg-base-200" : "hover:bg-base-200/60"
								}`}
							>
								<UserAvatar
									discordId={h.discordId}
									displayName={h.displayName}
									imageUrl={h.profileIconUrl ?? h.topChampion?.splashUrl ?? h.topChampion?.iconUrl ?? null}
									size="sm"
								/>
								<div className="min-w-0 flex-1">
									<div className="font-medium truncate text-sm">{h.displayName}</div>
									{h.mainAccount && (
										<div className="text-xs text-base-content/60 truncate tabular-nums">
											{h.mainAccount.gameName}
											<span className="opacity-50">#{h.mainAccount.tagLine}</span>
										</div>
									)}
								</div>
								<span className="text-xs text-base-content/40 shrink-0">→</span>
							</button>
						))
					)}
				</div>
			)}
		</div>
	);
}
