// PickBan 화면의 상태 / SWR / 저장 / WS / 단축키 / derived 계산 / 액션 묶음.
// 화면 컴포넌트 (PickBan.tsx) 는 이 hook 의 반환값을 layout 에 wiring 만 함.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api/rest.js";
import { wsClient } from "../../api/ws.js";
import type { SaveStatus } from "../../components/SaveStatus.js";
import { showToast } from "../../components/Toaster.js";
import { usePerms } from "../../state/perms.js";
import { useStaleWhileRevalidate } from "../../state/useStaleWhileRevalidate.js";
import {
	type Champion,
	emptyGameDraft,
	type GameDraft,
	type PickBanDraft,
	type SeriesDetail,
	type Side,
} from "./types.js";

export interface UsePickBanStateResult {
	// data
	detail: SeriesDetail | null;
	draft: PickBanDraft | null;
	champions: Champion[];
	error: string | null;
	// save status
	saveStatus: SaveStatus;
	savedAt: number | null;
	retrySave: () => void;
	// derived (detail 이 있을 때만 의미)
	teamSize: number;
	completedGames: Set<number>;
	noGamesPlayed: boolean;
	currentGameDraft: GameDraft | null;
	isCurrentGameRecorded: boolean;
	seriesCompleted: boolean;
	t1Wins: number;
	t2Wins: number;
	team1Side: Side | null;
	team2Side: Side | null;
	fearlessUsedIds: Set<number>;
	isGameTabEnabled: (n: number) => boolean;
	// 액션
	setCurrentGame: (n: number) => void;
	setSide: (side: Side) => void;
	setGameDraft: (g: GameDraft) => void;
	refresh: () => void;
	revert: () => Promise<boolean>;
	undoLast: () => Promise<void>;
	// 액션 에러 표시
	actionError: string | null;
	clearActionError: () => void;
}

export function usePickBanState({ seriesId }: { seriesId: number | null }): UsePickBanStateResult {
	const [draft, setDraft] = useState<PickBanDraft | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const perms = usePerms();

	// debounced save — 쓰기 권한 있는 경우에만 (SWR 의 dirty 보호 비교에 사용)
	const saveTimer = useRef<number | null>(null);
	const lastSavedDraft = useRef<string>("");

	// SWR — series detail. dirty 보호 onApply 안 (hot_fix.md §3.4).
	const detailFetcher = useCallback(() => api<SeriesDetail>(`/series/${seriesId}`), [seriesId]);
	const detailSwr = useStaleWhileRevalidate<SeriesDetail>(seriesId, detailFetcher, {
		debounceMs: 150,
		enabled: seriesId !== null,
		onApply: (next, prev) => {
			if (prev === null) {
				const teamSize = next.participants.length / 2;
				const initialDraft: PickBanDraft = next.pickbanDraft ?? {
					games: [1, 2, 3].map((n) => emptyGameDraft(n, teamSize, teamSize)),
					currentGame: 1,
				};
				setDraft(initialDraft);
				lastSavedDraft.current = JSON.stringify(initialDraft);
				return;
			}
			// 본인 dirty (lastSavedDraft 와 다름) 면 incoming pickbanDraft 무시.
			// 본인의 다음 PUT 이 last-write-wins 로 정렬됨.
			const localSerialized = draft ? JSON.stringify(draft) : "";
			const isLocalDirty = localSerialized !== lastSavedDraft.current;
			if (!isLocalDirty && next.pickbanDraft) {
				setDraft(next.pickbanDraft);
				lastSavedDraft.current = JSON.stringify(next.pickbanDraft);
			}
		},
	});
	const detail = detailSwr.data;
	const error = detailSwr.error;

	// SWR — champions 카탈로그 (시리즈 무관, 별도 캐시 단위).
	const champFetcher = useCallback(
		() => api<{ champions: Champion[] }>("/champions").then((r) => r.champions),
		[],
	);
	const champSwr = useStaleWhileRevalidate<Champion[]>("champions", champFetcher);
	const champions = useMemo(() => champSwr.data ?? [], [champSwr.data]);

	// series topic 구독 — 다른 사용자 변경 시 background refresh (플리커 X).
	useEffect(() => {
		if (seriesId === null) return;
		return wsClient.subscribe(`series:${seriesId}`, () => {
			detailSwr.refresh();
			showToast("다른 운영자가 픽/밴/결과를 입력했습니다");
		});
	}, [seriesId, detailSwr]);

	const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
	const [savedAt, setSavedAt] = useState<number | null>(null);
	const [retryNonce, setRetryNonce] = useState(0);
	useEffect(() => {
		if (!draft || seriesId === null || !perms.canEdit) return;
		const serialized = JSON.stringify(draft);
		if (serialized === lastSavedDraft.current) return;
		setSaveStatus("saving");
		if (saveTimer.current) window.clearTimeout(saveTimer.current);
		saveTimer.current = window.setTimeout(() => {
			api(`/series/${seriesId}/pickban`, {
				method: "PUT",
				body: serialized,
			})
				.then(() => {
					lastSavedDraft.current = serialized;
					setSaveStatus("saved");
					setSavedAt(performance.now());
				})
				.catch((err) => {
					console.warn("[mookbot] pickban save failed", err);
					setSaveStatus("error");
				});
		}, 400);
		return () => {
			if (saveTimer.current) window.clearTimeout(saveTimer.current);
		};
	}, [draft, seriesId, perms.canEdit, retryNonce]);

	// 1/2/3 단축키 — 게임 탭 전환. design_upgrade.md §4.5.
	useEffect(() => {
		if (!draft) return;
		const completedSet = new Set(detail?.games.map((g) => g.gameNumber) ?? []);
		const enabledFor = (n: number) => n === 1 || completedSet.has(n - 1);
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "1" && e.key !== "2" && e.key !== "3") return;
			const tag = (document.activeElement as HTMLElement | null)?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA") return;
			const n = Number(e.key);
			if (!enabledFor(n)) return;
			e.preventDefault();
			setDraft((prev) => (prev ? { ...prev, currentGame: n } : prev));
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [draft, detail]);

	// derived — detail/draft 이 없으면 안전한 기본값
	const teamSize = detail ? detail.participants.length / 2 : 0;
	const completedGames = useMemo(
		() => new Set(detail?.games.map((g) => g.gameNumber) ?? []),
		[detail],
	);
	const noGamesPlayed = (detail?.games.length ?? 0) === 0;
	const currentGameDraft = draft ? (draft.games[draft.currentGame - 1] ?? null) : null;
	const isCurrentGameRecorded = draft ? completedGames.has(draft.currentGame) : false;
	const seriesCompleted = detail?.series.status === "COMPLETED";

	const t1Wins = detail?.games.filter((g) => g.winningTeam === "TEAM_1").length ?? 0;
	const t2Wins = detail?.games.filter((g) => g.winningTeam === "TEAM_2").length ?? 0;

	const team1Side: Side | null = currentGameDraft?.team1Side ?? null;
	const team2Side: Side | null = team1Side === "BLUE" ? "RED" : team1Side === "RED" ? "BLUE" : null;

	const isGameTabEnabled = useCallback(
		(n: number): boolean => {
			if (n === 1) return true;
			return completedGames.has(n - 1);
		},
		[completedGames],
	);

	// Hard Fearless: 시리즈 내 같은 챔프 픽 금지 (양 팀 합산).
	// 현재 게임 이전의 모든 픽 → 현재 게임 그리드에서 비활성화.
	const fearlessUsedIds = useMemo(() => {
		const set = new Set<number>();
		if (!draft) return set;
		const currentGame = draft.currentGame;
		for (const g of detail?.games ?? []) {
			if (g.gameNumber >= currentGame) continue;
			for (const p of g.picks) if (p.championId !== null) set.add(p.championId);
		}
		// 미기록이지만 draft 에 작성된 이전 게임의 픽도 포함
		for (const g of draft.games) {
			if (g.gameNumber >= currentGame) continue;
			for (const team of ["TEAM_1", "TEAM_2"] as const) {
				for (const c of g.picks[team]) if (c !== null) set.add(c);
			}
		}
		return set;
	}, [detail, draft]);

	// 액션
	const setCurrentGame = useCallback(
		(n: number) => {
			if (!isGameTabEnabled(n)) return;
			setDraft((prev) => (prev ? { ...prev, currentGame: n } : prev));
		},
		[isGameTabEnabled],
	);

	const setSide = useCallback((side: Side) => {
		setDraft((prev) => {
			if (!prev) return prev;
			const games = prev.games.map((g, i) =>
				i === prev.currentGame - 1 ? { ...g, team1Side: side } : g,
			);
			return { ...prev, games };
		});
	}, []);

	const setGameDraft = useCallback((g: GameDraft) => {
		setDraft((prev) => {
			if (!prev) return prev;
			const games = prev.games.map((x, i) => (i === prev.currentGame - 1 ? g : x));
			return { ...prev, games };
		});
	}, []);

	const revert = useCallback(async (): Promise<boolean> => {
		setActionError(null);
		try {
			await api(`/series/${seriesId}/revert`, { method: "POST" });
			return true;
		} catch (err) {
			setActionError(`되돌리기 실패: ${err instanceof Error ? err.message : String(err)}`);
			return false;
		}
	}, [seriesId]);

	const undoLast = useCallback(async () => {
		setActionError(null);
		try {
			await api(`/series/${seriesId}/games/last`, { method: "DELETE" });
			detailSwr.refresh();
		} catch (err) {
			setActionError(`되돌리기 실패: ${err instanceof Error ? err.message : String(err)}`);
		}
	}, [seriesId, detailSwr]);

	const retrySave = useCallback(() => setRetryNonce((n) => n + 1), []);
	const clearActionError = useCallback(() => setActionError(null), []);

	return {
		detail,
		draft,
		champions,
		error,
		saveStatus,
		savedAt,
		retrySave,
		teamSize,
		completedGames,
		noGamesPlayed,
		currentGameDraft,
		isCurrentGameRecorded,
		seriesCompleted: !!seriesCompleted,
		t1Wins,
		t2Wins,
		team1Side,
		team2Side,
		fearlessUsedIds,
		isGameTabEnabled,
		setCurrentGame,
		setSide,
		setGameDraft,
		refresh: detailSwr.refresh,
		revert,
		undoLast,
		actionError,
		clearActionError,
	};
}
