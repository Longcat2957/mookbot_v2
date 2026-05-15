import { useEffect, useState } from "react";
import { api } from "../../../api/rest.js";
import type { HistoryResponse } from "./types.js";

export function useMmrHistory(userId: string) {
	const [data, setData] = useState<HistoryResponse | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setData(null);
		setError(null);
		api<HistoryResponse>(`/users/${userId}/mmr-history?limit=200`)
			.then(setData)
			.catch((err) => setError(err instanceof Error ? err.message : String(err)));
	}, [userId]);

	return { data, error };
}
