import { useCallback } from "react";
import { api } from "../../api/rest.js";
import { usePerms } from "../../state/perms.js";
import { useStaleWhileRevalidate } from "../../state/useStaleWhileRevalidate.js";
import type { MeProfileResponse } from "./types.js";

export function useMeProfile() {
	const perms = usePerms();
	const userId = perms.discordId;
	const fetcher = useCallback(() => api<MeProfileResponse>(`/users/${userId}/profile`), [userId]);
	const swr = useStaleWhileRevalidate<MeProfileResponse>(`me-hero:${userId}`, fetcher, {
		debounceMs: 200,
		enabled: !!userId,
	});

	return { userId, ...swr };
}
