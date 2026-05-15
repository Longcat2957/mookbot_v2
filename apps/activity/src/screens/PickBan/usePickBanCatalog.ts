import { useCallback, useMemo } from "react";
import { api } from "../../api/rest.js";
import { useStaleWhileRevalidate } from "../../state/useStaleWhileRevalidate.js";
import type { Champion } from "./types.js";

export function usePickBanCatalog(): Champion[] {
	const champFetcher = useCallback(
		() => api<{ champions: Champion[] }>("/champions").then((r) => r.champions),
		[],
	);
	const champSwr = useStaleWhileRevalidate<Champion[]>("champions", champFetcher);
	return useMemo(() => champSwr.data ?? [], [champSwr.data]);
}
