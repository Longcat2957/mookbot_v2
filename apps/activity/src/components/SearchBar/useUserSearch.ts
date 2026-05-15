import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../api/rest.js";
import type { SearchHit, SearchResponse } from "./types.js";

const DEBOUNCE_MS = 200;

export function useUserSearch(query: string) {
	const [hits, setHits] = useState<SearchHit[]>([]);
	const [loading, setLoading] = useState(false);
	const [activeIdx, setActiveIdx] = useState(0);
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
			const response = await api<SearchResponse>(`/users/search?q=${encodeURIComponent(q)}`);
			if (seq !== reqSeq.current) return;
			setHits(response.users);
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

	const clearHits = useCallback(() => setHits([]), []);

	return { hits, loading, activeIdx, setActiveIdx, clearHits };
}
