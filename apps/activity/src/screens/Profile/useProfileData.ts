import { useCallback, useEffect } from "react";
import { api } from "../../api/rest.js";
import { wsClient } from "../../api/ws.js";
import { showToast } from "../../components/Toaster.js";
import { useStaleWhileRevalidate } from "../../state/useStaleWhileRevalidate.js";
import type { ProfileResponse } from "./types.js";

export function useProfileData(userId: string) {
	const fetcher = useCallback(() => api<ProfileResponse>(`/users/${userId}/profile`), [userId]);
	const swr = useStaleWhileRevalidate<ProfileResponse>(`profile:${userId}`, fetcher, {
		debounceMs: 150,
	});

	useEffect(() => {
		return wsClient.subscribe(`user:${userId}`, () => {
			swr.refresh();
			showToast("프로필이 업데이트되었습니다");
		});
	}, [userId, swr]);

	return {
		data: swr.data,
		error: swr.error,
	};
}
