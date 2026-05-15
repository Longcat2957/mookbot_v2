import { useCallback, useMemo } from "react";
import { api } from "../../api/rest.js";
import { useStaleWhileRevalidate } from "../../state/useStaleWhileRevalidate.js";
import type { Champion, SeriesDetail } from "./types.js";

export function useSeriesResultData(seriesId: number | null) {
	const detailFetcher = useCallback(() => api<SeriesDetail>(`/series/${seriesId}`), [seriesId]);
	const detailSwr = useStaleWhileRevalidate<SeriesDetail>(seriesId, detailFetcher, {
		debounceMs: 150,
		enabled: seriesId !== null,
	});
	const champFetcher = useCallback(
		() => api<{ champions: Champion[] }>("/champions").then((response) => response.champions),
		[],
	);
	const champSwr = useStaleWhileRevalidate<Champion[]>("champions", champFetcher);

	const champions = useMemo(() => champSwr.data ?? [], [champSwr.data]);
	const champById = useMemo(() => {
		const map = new Map<number, Champion>();
		for (const champ of champions) map.set(champ.id, champ);
		return map;
	}, [champions]);

	return {
		champById,
		detail: detailSwr.data,
		error: detailSwr.error,
	};
}
