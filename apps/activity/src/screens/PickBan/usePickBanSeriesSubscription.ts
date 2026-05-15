import { useEffect } from "react";
import { wsClient } from "../../api/ws.js";
import { showToast } from "../../components/Toaster.js";

export function usePickBanSeriesSubscription({
	seriesId,
	refresh,
}: {
	seriesId: number | null;
	refresh: () => void;
}) {
	useEffect(() => {
		if (seriesId === null) return;
		return wsClient.subscribe(`series:${seriesId}`, () => {
			refresh();
			showToast("다른 운영자가 픽/밴/결과를 입력했습니다");
		});
	}, [seriesId, refresh]);
}
