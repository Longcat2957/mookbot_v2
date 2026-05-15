import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/rest.js";

export interface ChampionCatalogItem {
	id: number;
	idSlug: string;
	name: string;
	iconUrl: string;
}

type CatalogSnapshot = {
	data: ChampionCatalogItem[] | null;
	error: string | null;
	refreshing: boolean;
};

const listeners = new Set<() => void>();

let cachedChampions: ChampionCatalogItem[] | null = null;
let cachedError: string | null = null;
let inflight: Promise<ChampionCatalogItem[]> | null = null;

function getSnapshot(): CatalogSnapshot {
	return {
		data: cachedChampions,
		error: cachedError,
		refreshing: inflight !== null,
	};
}

function notify() {
	for (const listener of listeners) listener();
}

function fetchChampionCatalog(force = false): Promise<ChampionCatalogItem[]> {
	if (!force && cachedChampions !== null) return Promise.resolve(cachedChampions);
	if (!force && inflight !== null) return inflight;

	inflight = api<{ champions: ChampionCatalogItem[] }>("/champions")
		.then((response) => {
			cachedChampions = response.champions;
			cachedError = null;
			return response.champions;
		})
		.catch((err) => {
			cachedError = err instanceof Error ? err.message : String(err);
			throw err;
		})
		.finally(() => {
			inflight = null;
			notify();
		});

	notify();
	return inflight;
}

export function preloadChampionCatalog() {
	void fetchChampionCatalog().catch(() => {});
}

export function useChampionCatalog<TChampion extends ChampionCatalogItem = ChampionCatalogItem>() {
	const [snapshot, setSnapshot] = useState<CatalogSnapshot>(() => getSnapshot());

	useEffect(() => {
		const sync = () => setSnapshot(getSnapshot());
		listeners.add(sync);
		sync();
		void fetchChampionCatalog().catch(() => {});
		return () => {
			listeners.delete(sync);
		};
	}, []);

	const refresh = useCallback(() => {
		void fetchChampionCatalog(true).catch(() => {});
	}, []);

	return {
		data: snapshot.data as TChampion[] | null,
		champions: (snapshot.data ?? []) as TChampion[],
		error: snapshot.error,
		refreshing: snapshot.refreshing,
		refresh,
	};
}
