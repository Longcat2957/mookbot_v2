import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../api/rest.js";
import { wsClient } from "../../api/ws.js";
import { showToast } from "../../components/Toaster.js";
import { useStaleWhileRevalidate } from "../../state/useStaleWhileRevalidate.js";
import type {
	AuctionRecListItem,
	CompletedSeries,
	PendingItem,
	Recruitment,
	SeriesItem,
} from "./types.js";

const PAGE_SIZE = 8;

export function useDashboardData() {
	const [page, setPage] = useState(1);

	const fetchPending = useCallback(async () => {
		const [r, s, ar] = await Promise.all([
			api<{ recruitments: Recruitment[] }>("/recruitments"),
			api<{ series: SeriesItem[] }>("/series"),
			api<{ recruitments: AuctionRecListItem[] }>("/auction-recruitments").catch(() => ({
				recruitments: [] as AuctionRecListItem[],
			})),
		]);
		return {
			recruitments: r.recruitments,
			series: s.series,
			auctionRecs: ar.recruitments,
		};
	}, []);

	const fetchCompleted = useCallback(async () => {
		const offset = (page - 1) * PAGE_SIZE;
		const c = await api<{ series: CompletedSeries[]; total: number }>(
			`/series/completed?limit=${PAGE_SIZE}&offset=${offset}`,
		);
		return { items: c.series, total: c.total };
	}, [page]);

	const pendingSwr = useStaleWhileRevalidate("dashboard", fetchPending, { debounceMs: 150 });
	const completedSwr = useStaleWhileRevalidate(`dashboard:completed:p${page}`, fetchCompleted, {
		debounceMs: 150,
	});

	const recruitments = pendingSwr.data?.recruitments ?? null;
	const series = pendingSwr.data?.series ?? null;
	const auctionRecs = pendingSwr.data?.auctionRecs ?? null;
	const completed = completedSwr.data?.items ?? null;
	const completedTotal = completedSwr.data?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(completedTotal / PAGE_SIZE));
	const error = pendingSwr.error ?? completedSwr.error;
	const isLoading =
		recruitments === null || series === null || completed === null || auctionRecs === null;

	useEffect(() => {
		if (completedSwr.data && page > totalPages) setPage(totalPages);
	}, [completedSwr.data, page, totalPages]);

	useEffect(() => {
		return wsClient.subscribe("dashboard", () => {
			pendingSwr.refresh();
			completedSwr.refresh();
			showToast("대시보드가 업데이트되었습니다");
		});
	}, [pendingSwr, completedSwr]);

	const pending = useMemo(() => {
		if (recruitments === null || series === null) return [];
		const items: PendingItem[] = [];
		for (const r of recruitments) items.push({ kind: "rec", data: r, sortKey: r.createdAt });
		for (const s of series) items.push({ kind: "series", data: s, sortKey: s.startedAt });
		items.sort((a, b) => a.sortKey - b.sortKey);
		return items;
	}, [recruitments, series]);

	const refresh = () => {
		pendingSwr.refresh();
		completedSwr.refresh();
	};

	return {
		page,
		setPage,
		recruitments,
		series,
		auctionRecs,
		completed,
		completedTotal,
		totalPages,
		error,
		isLoading,
		pending,
		refresh,
	};
}
