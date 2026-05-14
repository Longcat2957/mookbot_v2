// Stale-While-Revalidate fetch hook — hot_fix.md §3.1.
//
// 목적: WS invalidate 시 화면이 잠깐 비었다가 다시 채워지는 플리커링 제거.
//
// 기존 패턴 (X):
//   useEffect(() => {
//     setData(null);          // ← 화면을 빈 상태로 reset (플리커 원인)
//     api(...).then(setData);
//   }, [key, reloadKey]);
//
// 본 hook (O):
//   const swr = useStaleWhileRevalidate(key, () => api(...), { onApply, debounceMs });
//   useEffect(() => wsClient.subscribe("topic", swr.refresh), [swr]);
//
//   // 렌더:
//   if (swr.data === null && !swr.error) return <Skeleton />;     // 첫 로드만
//   const data = swr.data!;
//
// 동작:
//   - 첫 로드 전엔 data === null (skeleton 노출용)
//   - 그 이후 data 는 null 로 절대 돌아가지 않음. 새 fetch 결과가 도착할 때만
//     swap → 화면이 비지 않음.
//   - refresh() 호출 시 inflight fetch 가 있으면 queued 로 marking 만 하고
//     끝난 후 1 회 더 fetch. WS reconnect 직후 invalidate 폭발 보호.
//   - debounceMs (default 100ms) — 짧은 시간 다중 refresh() 를 한 번으로 묶음.
//   - onApply(next, prev) — 호출처가 새/이전 데이터를 비교해 dirty 보호 /
//     변경 위치 highlight 등을 결정할 수 있음.

import { useCallback, useEffect, useRef, useState } from "react";

export interface SwrState<T> {
	/** 첫 로드 전엔 null. 그 이후엔 절대 null 로 돌아가지 않음. */
	data: T | null;
	/** 마지막 fetch 실패 사유 (있으면). 다음 성공 시 자동 clear. */
	error: string | null;
	/** background refresh (= 두 번째 이상 fetch) 진행 중. */
	refreshing: boolean;
	/** 외부에서 fetch 재실행 (debounced). WS invalidate 콜백에서 호출. */
	refresh: () => void;
}

export interface SwrOptions<T> {
	/** refresh() 호출의 burst 흡수 윈도우 (default 100ms). */
	debounceMs?: number;
	/**
	 * 새 데이터 도착 시 호출. 호출처는 prev 와 비교해 본인 dirty state 보호 /
	 * 변경 위치 시각 강조 등 도메인 정책을 결정한다. data 자체는 hook 이 무조건
	 * setState(next) 로 교체.
	 */
	onApply?: (next: T, prev: T | null) => void;
	/**
	 * false 면 fetch 를 시도하지 않는다 (key 가 아직 결정되지 않은 일시 상태).
	 * 기존 data 는 그대로 유지. default true.
	 */
	enabled?: boolean;
}

export function useStaleWhileRevalidate<T>(
	key: unknown,
	fetcher: () => Promise<T>,
	opts: SwrOptions<T> = {},
): SwrState<T> {
	const [data, setData] = useState<T | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [refreshing, setRefreshing] = useState(false);
	const [nonce, setNonce] = useState(0);

	const debounceTimer = useRef<number | null>(null);
	const inflight = useRef(false);
	const queued = useRef(false);
	// fetcher / onApply 는 매 렌더 새 closure — useEffect deps 에 넣으면
	// 무한 fetch. ref 로 latest 값을 잡아 effect 안에서만 호출.
	const fetcherRef = useRef(fetcher);
	const onApplyRef = useRef(opts.onApply);
	useEffect(() => {
		fetcherRef.current = fetcher;
		onApplyRef.current = opts.onApply;
	});

	// key 변경 시 데이터 reset (시리즈 / 모집 전환). 첫 로드 skeleton 다시 노출.
	useEffect(() => {
		setData(null);
		setError(null);
		setRefreshing(false);
	}, [key]);

	useEffect(() => {
		if (opts.enabled === false) return;
		let cancelled = false;

		const run = async () => {
			if (inflight.current) {
				queued.current = true; // 진행 중 — 끝나면 1 회 더
				return;
			}
			inflight.current = true;
			// data 가 이미 있으면 background refresh — refreshing 만 표시 (skeleton X)
			setRefreshing((prev) => prev || data !== null);
			try {
				const next = await fetcherRef.current();
				if (cancelled) return;
				setData((prev) => {
					try {
						onApplyRef.current?.(next, prev);
					} catch (err) {
						// onApply 사용자 콜백의 버그를 silent 하게 삼키지 않도록 console.error.
						// 데이터 자체는 그대로 적용 — 사용자 콜백 실패가 stale 화면을 만들지 않게.
						console.error("[swr] onApply threw — fix the callback", err);
					}
					return next;
				});
				setError(null);
			} catch (e) {
				if (!cancelled) {
					setError(e instanceof Error ? e.message : String(e));
				}
			} finally {
				if (!cancelled) {
					inflight.current = false;
					setRefreshing(false);
					if (queued.current) {
						queued.current = false;
						// 다음 macrotask 에 재실행 — useEffect 안에서 setNonce 직접 호출 시
						// 같은 렌더에 이중 schedule 위험
						window.setTimeout(() => {
							if (!cancelled) setNonce((n) => n + 1);
						}, 0);
					}
				}
			}
		};

		run();
		return () => {
			cancelled = true;
		};
		// data 를 deps 에 안 넣음 — fetch 결과로 data 가 바뀌면 무한 loop.
		// inflight/queued/data 는 ref/closure 로 latest 유지.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key, nonce, opts.enabled]);

	const refresh = useCallback(() => {
		const delay = opts.debounceMs ?? 100;
		if (debounceTimer.current !== null) {
			window.clearTimeout(debounceTimer.current);
		}
		debounceTimer.current = window.setTimeout(() => {
			debounceTimer.current = null;
			setNonce((n) => n + 1);
		}, delay);
		// debounceMs 변동을 의도적으로 무시 — 첫 호출의 값 사용. 컴포넌트
		// lifetime 동안 변하지 않는 게 일반적이라 OK.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [opts.debounceMs]);

	useEffect(
		() => () => {
			if (debounceTimer.current !== null) {
				window.clearTimeout(debounceTimer.current);
			}
		},
		[],
	);

	return { data, error, refreshing, refresh };
}
