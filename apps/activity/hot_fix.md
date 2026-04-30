# Hot Fix — WS 동시 편집 플리커링 제거

> **상황**
> 여러 운영자가 동시에 같은 모집 / 시리즈를 편집할 때 WS 기반 실시간 상태
> 공유 자체는 정상 동작한다. 그러나 다른 운영자의 변경이 들어올 때마다
> 화면이 한 번 비었다가 다시 채워지는 **플리커링** 이 발생해 UX 를 크게
> 해친다. 본 문서는 원인을 정리하고, daisyUI 추가 도입 없이 React /
> 기존 WS 인프라만으로 해결할 구체 계획을 정의한다.

---

## 1. 현상 진단

### 1.1 사용자가 보는 것

- 다른 운영자가 슬롯 1 칸을 옮기면 → 본인 화면에서 **모든 슬롯이 한순간
  비었다가** 다시 채워짐 (~ 200ms 의 빈 깜빡임)
- 픽/밴 화면에서 다른 운영자가 챔프 1 개를 픽하면 → 보드 전체 / 챔프
  그리드 / 라인업이 깜빡 → 본인 활성 슬롯(activeSlot) / 검색어 / sticky
  안내 등 **로컬 transient state 가 사라짐**
- 변경 toast 가 동시에 떠서 spam 인상 (드래그 한 번에 여러 invalidate)
- 결과: "누가 옆에서 만지고 있구나" 가 아니라 "내 화면이 자꾸 망가지네"
  로 인식

### 1.2 코드 레벨 원인

세 화면(`RecruitmentList` / `EntryEditing` / `PickBan`) 모두 동일 안티패턴:

```ts
useEffect(() => {
  setError(null);
  setDetail(null);          //  ← (A) 화면을 빈 상태로 reset
  api<Detail>(`/...`)
    .then(res => {
      setDetail(res);
      setAssignment(...);   //  ← (B) 로컬 state 도 서버 응답으로 덮어씀
    });
}, [id, reloadKey]);
```

WS callback 은 `setReloadKey(k => k + 1)` 를 호출 — 이 effect 가 다시
돌면서 (A) 가 화면을 unmount → fetch 완료까지 ~ 100~300ms skeleton
노출 → 다시 mount. 이게 **플리커**.

추가로:

- **(B) 의 부작용**: 본인이 막 드래그 / 탭으로 옮긴 미저장 변경이 이미
  서버에 PUT 되었더라도, 다른 운영자 변경의 fetch 결과 가 그것을
  덮어쓸 수 있고 (race), 본인 입력 컨텍스트(`selectedUid`, `activeSlot`,
  `search`)가 휘발됨. 컴포넌트는 살아있어도 props 변동 ripple 로 child
  state 가 reset 되는 경로가 있음.
- **toast spam**: WS broadcast 가 입력 단위로 fire (드래그 1 회 = PUT
  1 회 = invalidate 1 회). 여러 슬롯을 빠르게 옮기는 운영자가 있으면
  옆 사람 화면에 토스트가 겹쳐서 표시.
- **WS reconnect 직후 폭발**: 짧은 disconnect 후 reconnect 시 그동안
  쌓인 invalidate 가 queue 처럼 들어와 동일 화면을 수 회 reload.

### 1.3 무엇이 플리커가 *아닌가*

- 단순 transition CSS 추가로 해결 안 됨 — 문제는 컴포넌트가 잠시 unmount
  되는 것 자체.
- React 의 `useTransition` / `Suspense` 도 fetch 사이의 빈 frame 을
  근본적으로 없애주지는 않음 (현 구조는 그냥 setState(null) 패턴).

---

## 2. 해결 원칙

세 줄로 압축:

1. **Stale-While-Revalidate.** 백그라운드 refresh 동안 화면을 비우지
   않는다. 새 데이터 도착 시점에만 swap.
2. **로컬 transient state 는 서버 동기화와 분리.** activeSlot, search,
   selectedUid 는 detail reload 와 무관하게 보존.
3. **본인 dirty 변경 보호.** 본인이 아직 저장하지 않았거나 막 PUT 했지만
   echo 가 늦게 도착한 변경은, 다른 운영자의 fetch 결과로 덮이지 않게.

> 비목표: 새 라이브러리(react-query, swr, zustand 등) 도입. 기존 useState +
> useRef + 작은 헬퍼만으로 처리.

---

## 3. 구체 코드 변경 계획

### 3.1 공통 헬퍼 — `useStaleWhileRevalidate`

세 화면의 fetch effect 패턴을 묶는 작은 hook.

```ts
// apps/activity/src/state/useStaleWhileRevalidate.ts
import { useEffect, useRef, useState } from "react";

export interface SwrState<T> {
  data: T | null;        // 첫 로드 전엔 null. 그 이후엔 절대 null 로 안 돌아감.
  error: string | null;  // 마지막 fetch 실패 사유 (있으면)
  refreshing: boolean;   // background refresh 진행 중 (= 두 번째 이상 fetch)
  refresh: () => void;
}

export function useStaleWhileRevalidate<T>(
  key: unknown,                       // recruitmentId / seriesId 등 — 바뀌면 첫 로드 reset
  fetcher: () => Promise<T>,
  opts: { debounceMs?: number; onApply?: (next: T, prev: T | null) => void } = {},
): SwrState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);
  const debounceTimer = useRef<number | null>(null);
  const inflight = useRef(false);
  const queued = useRef(false);

  // key 변경 시 데이터 reset (시리즈 전환 등)
  useEffect(() => {
    setData(null);
    setError(null);
  }, [key]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (inflight.current) {
        queued.current = true;          // 이미 진행 중 — 끝나면 1 회 더
        return;
      }
      inflight.current = true;
      if (data !== null) setRefreshing(true);
      try {
        const next = await fetcher();
        if (cancelled) return;
        setData(prev => {
          opts.onApply?.(next, prev);
          return next;
        });
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        inflight.current = false;
        setRefreshing(false);
        if (queued.current && !cancelled) {
          queued.current = false;
          setNonce(n => n + 1);          // 한 번 더
        }
      }
    };
    run();
    return () => { cancelled = true; };
    // fetcher 는 항상 latest closure 를 잡기 위해 deps 에 안 넣음.
    // 의도적으로 key + nonce 만으로 재실행.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);

  const refresh = () => {
    const delay = opts.debounceMs ?? 100;
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => {
      debounceTimer.current = null;
      setNonce(n => n + 1);
    }, delay);
  };

  return { data, error, refreshing, refresh };
}
```

**핵심 차이점**:
- `setData(null)` 을 fetch 시작 시 절대 호출하지 않음 — 첫 로드만 null 이고,
  그 후부터는 항상 직전 데이터 유지하다가 새 데이터로 swap.
- `inflight` + `queued` 로 "WS invalidate 가 fetch 진행 중에 추가로 와도
  중복 fetch 안 하고 끝나면 1 번만 추가". WS reconnect 폭발 보호.
- `debounceMs` 로 짧은 시간 내 여러 refresh 호출을 합침 (드래그 1 회당
  invalidate 1 개여도 모달/연속 동작 시 묶임). 기본 100ms.
- `onApply(next, prev)` 콜백 — 호출처가 두 데이터의 diff 를 보고
  어떤 슬롯이 바뀌었는지 highlight 처리할 수 있게.

### 3.2 `RecruitmentList` 적용

현재:
```ts
useEffect(() => {
  setRecruitments(null); setSeries(null); setCompleted(null);
  Promise.all([api(...), api(...), api(...)]).then(([r, s, c]) => { ... });
}, [reloadKey]);
```

변경:
```ts
const swr = useStaleWhileRevalidate("dashboard", async () => {
  const [r, s, c] = await Promise.all([
    api<{ recruitments: Recruitment[] }>("/recruitments"),
    api<{ series: SeriesItem[] }>("/series"),
    api<{ series: CompletedSeries[] }>("/series/completed?limit=20"),
  ]);
  return { recruitments: r.recruitments, series: s.series, completed: c.series };
}, { debounceMs: 150 });

useEffect(() => wsClient.subscribe("dashboard", () => {
  swr.refresh();
  showToast("대시보드가 업데이트되었습니다");
}), [swr]);

// 렌더에서:
const isFirstLoad = swr.data === null && !swr.error;
if (isFirstLoad) return <SkeletonGrid />;
const { recruitments, series, completed } = swr.data!;
```

플리커 사라짐 — WS invalidate 가 와도 카드 그리드는 화면에 그대로 남고,
fetch 완료 시점에 카드 내용만 (필요한 것만) 교체.

### 3.3 `EntryEditing` 적용

현재 패턴:
```ts
useEffect(() => {
  setError(null); setDetail(null);
  api(`/recruitments/${id}`).then(res => {
    setDetail(res);
    setAssignment(buildFromDraft(res.entryDraft));   // ← 본인 dirty 덮어씀
  });
}, [recruitmentId, reloadKey]);
```

변경:
```ts
const swr = useStaleWhileRevalidate(
  recruitmentId,
  () => api<RecruitmentDetail>(`/recruitments/${recruitmentId}`),
  {
    debounceMs: 150,
    onApply: (next, prev) => {
      // (1) 첫 로드 — server draft 무조건 반영
      if (prev === null) {
        setAssignment(buildFromDraft(next.entryDraft));
        return;
      }
      // (2) 본인 dirty 보호 — assignment 가 lastSaved 와 다르면 본인 것 우선
      const localSerialized = JSON.stringify(Object.fromEntries(assignment));
      const isLocalDirty = localSerialized !== lastSaved.current;
      if (isLocalDirty) {
        // 본인 미저장 변경 있음 — 무시하고 본인 state 유지.
        // 이후 본인의 debounced PUT 이 서버에 반영되며 echo 로 정렬됨.
        return;
      }
      // (3) 본인 clean → server 값으로 동기화
      const nextAssignment = buildFromDraft(next.entryDraft);
      setAssignment(nextAssignment);
      lastSaved.current = JSON.stringify(Object.fromEntries(nextAssignment));
    },
  },
);

useEffect(() => {
  if (recruitmentId === null) return;
  return wsClient.subscribe(`recruitment:${recruitmentId}`, () => {
    swr.refresh();
    showToast("다른 운영자가 엔트리를 수정했습니다");
  });
}, [recruitmentId, swr]);
```

추가로 `selectedUid` 등 transient state 는 detail reload 와 완전 독립이라
이미 보존되지만, 이번 변경으로 "전체 빈 화면 깜빡임" 자체가 사라지므로
사용자 인지가 안정됨.

### 3.4 `PickBan` 적용

가장 영향 큼. `setDetail(null)` + `setDraft(null)` 두 reset 이 모두 화면
폭발 원인.

```ts
const swr = useStaleWhileRevalidate(
  seriesId,
  () => api<SeriesDetail>(`/series/${seriesId}`),
  {
    debounceMs: 150,
    onApply: (next, prev) => {
      if (prev === null) {
        // 첫 로드 — server draft 또는 fresh draft
        const teamSize = next.participants.length / 2;
        setDraft(next.pickbanDraft ?? {
          games: [1, 2, 3].map(n => emptyGameDraft(n, teamSize, teamSize)),
          currentGame: 1,
        });
        return;
      }
      // (2) 본인 미저장 draft 보호
      const localSerialized = JSON.stringify(draft);
      const isLocalDirty = localSerialized !== lastSavedDraft.current;
      if (isLocalDirty) return;
      // (3) 본인 clean → server draft 동기화
      if (next.pickbanDraft) {
        setDraft(next.pickbanDraft);
        lastSavedDraft.current = JSON.stringify(next.pickbanDraft);
      }
      // games (기록된 게임) 은 server-only — detail.games 그대로 사용 (덮어쓰기 OK)
    },
  },
);
```

`activeSlot`, `search`, `pendingAction`(이미 ConfirmButton 으로 흡수됨) 등
PickBanBoard 의 로컬 state 는 부모 detail 변경과 무관하므로 자동 보존.

`champions` 는 별도 fetch — series 와 무관하니 별도 SWR 로 분리:
```ts
const champSwr = useStaleWhileRevalidate("champions", () =>
  api<{ champions: Champion[] }>("/champions").then(r => r.champions),
);
```

### 3.5 `SeriesResult`

읽기 전용 화면 — dirty 보호 불필요. 단순히 SWR 만 적용해도 플리커 제거.

### 3.6 변경 위치 시각 강조 (선택, +α)

플리커가 사라지면 "다른 운영자가 무엇을 바꿨는지" 가 오히려 안 보일 수
있다. `onApply(next, prev)` 콜백 안에서 diff 계산 → 변경된 key 에 1 초간
`ring-info ring-2 animate-pulse` 적용:

```ts
// EntryEditing
onApply: (next, prev) => {
  if (prev) {
    const changed = diffAssignments(prev.entryDraft, next.entryDraft);
    setRecentlyChanged(changed);   // Set<userId>
    window.setTimeout(() => setRecentlyChanged(new Set()), 1500);
  }
  // ...assign 정책 동일
}

// 슬롯 / 카드 className:
const isRecent = recentlyChanged.has(participant.userId);
className={`... ${isRecent ? "ring-2 ring-info animate-pulse" : ""}`}
```

플리커 → 잔잔한 펄스로 변환. design_upgrade.md §4.1 "변경 위치 시각화"
의 backend-less 단순 구현.

### 3.7 토스트 dedupe / 묶음

`showToast` 자체에 dedupe 로직 추가:

```ts
// components/Toaster.tsx
let lastToast: { msg: string; time: number } | null = null;
export function showToast(message: string, tone: ToastTone = "info") {
  const now = performance.now();
  if (lastToast && lastToast.msg === message && now - lastToast.time < 1500) {
    return; // 1.5s 내 동일 메시지 무시
  }
  lastToast = { msg: message, time: now };
  // ...기존 로직
}
```

연속 변경 시 토스트 1 개만 보임.

### 3.8 WS 재연결 직후 폭발 방지

`api/ws.ts` 의 `open` 핸들러에 짧은 settle 윈도우. 재연결 후 첫 N ms 동안
들어오는 invalidate 는 "1 회로 묶기" — 이미 SWR 의 `inflight + queued` 가
일부 흡수하지만, 명시적으로 "reconnect 직후 첫 invalidate 는 무조건 fetch
1 회만" 으로:

```ts
ws.addEventListener("open", () => {
  this.setStatus("connected");
  this.justReconnectedAt = performance.now();
  for (const topic of this.joined) ws.send(JSON.stringify({ t: "join", topic }));
});

// invalidate handler 안:
const since = performance.now() - (this.justReconnectedAt ?? -Infinity);
if (since < 500) {
  // 묶기: 다음 macrotask 에 한 번만 fire
  ...
}
```

복잡도 vs 가치 — SWR 의 `inflight+queued` 만으로 충분할 수 있어 우선
관찰 후 결정.

---

## 4. 구현 순서 (수직)

각 단계는 단독 mergeable, 점진 검증.

| 단계 | 작업 | 예상 영향 |
|---|---|---|
| H1 | `useStaleWhileRevalidate` hook 추가 (테스트 없이 단독 PR) | 0 — 미사용 |
| H2 | `RecruitmentList` 에 적용 | 대시보드 깜빡임 즉시 제거 |
| H3 | `EntryEditing` 적용 + dirty-protection | 플리커 + 본인 입력 손실 동시 해결 |
| H4 | `PickBan` 적용 + champions SWR 분리 | 가장 큰 시각 임팩트 |
| H5 | `SeriesResult` 적용 | 부수적 — read-only 화면 |
| H6 | `showToast` dedupe (1.5s window) | 토스트 spam 즉시 완화 |
| H7 | 변경 위치 펄스 (`recentlyChanged` set) | "누가 무엇을 바꿨는지" 가시화 — 플리커 제거의 부작용 보완 |
| H8 | WS reconnect settle window (관찰 후 결정) | edge case |

H2 ~ H4 만 머지해도 사용자 보고된 플리커는 거의 사라짐. H6, H7 은 보강.

---

## 5. 검증 기준

### 5.1 기능 (회귀 없음)
- [ ] 본인이 슬롯을 옮기면 자기 화면에 즉시 반영 (낙관적, 변동 없음)
- [ ] 다른 운영자가 슬롯을 옮기면 1 ~ 1.5 초 내 본인 화면에도 반영
- [ ] 본인이 slot A 를 막 옮기는 중에 (저장 전) 다른 운영자가 다른 slot
      를 옮겨도 본인 입력은 사라지지 않음
- [ ] 본인이 막 PUT 한 변경이 echo 도 안 받았는데 다른 운영자 변경이
      도착 → 본인 변경이 덮이지 않음 (lastSaved.current 비교)
- [ ] WS disconnect → reconnect 후 화면 1 회만 reload (다중 invalidate
      섞여도)

### 5.2 시각 (플리커 부재)
- [ ] WS invalidate 가 와도 화면이 빈 상태 (skeleton) 로 잠깐 전환되지
      않음 — 첫 로드 외에는 skeleton 무노출
- [ ] 카드 / 슬롯 / 챔프 그리드의 image / text 가 깜빡이지 않음
- [ ] 변경된 항목에 ring-info pulse 1.5 초 (옵션 H7 적용 시)
- [ ] 토스트가 1.5 초 내 동일 메시지 중복 노출되지 않음

### 5.3 성능
- [ ] WS invalidate 폭발 시 (예: 5 회/초) fetch 가 최대 ~ 6.7 회/초
      (debounce 150ms) 로 제한
- [ ] 같은 데이터 fetch 가 inflight 중이면 추가 fetch 스킵 + 끝난 후 1 회
      만 follow-up

### 5.4 접근성 / a11y
- [ ] swr.refreshing 인 동안 사용자에게 거슬리지 않는 미세 표시 (옵션 —
      navbar SystemDot 외 추가는 안 권장)

---

## 6. 비목표 (Non-Goals)

- 새 상태관리 라이브러리 도입 (react-query / swr / zustand / valtio 등)
- WS payload schema 변경 (현재는 `{t: "invalidate", topic, originUser}`
  유지). 메시지 안에 변경 detail 을 담는 "granular update" 로의 전환은
  backend 작업이 커서 후속.
- Optimistic UI 의 일반화 (본인 입력은 이미 즉시 반영되고 PUT 은 background.
  이 이상의 conflict resolution 은 도메인상 불필요)
- 변경 history / undo log

---

## 7. 도메인 결정 메모

- **Last-write-wins 유지**. 본인 dirty 가 있을 때 incoming server 변경을
  무시하더라도, 결국 본인의 다음 PUT 이 lastSaved 가 됨. 즉 운영자 두
  명이 동시에 같은 슬롯을 옮기면 더 늦게 PUT 한 쪽이 이김 — 현재 정책과
  동일. 이번 작업은 그 정책을 바꾸지 않고 **시각 안정성** 만 다룬다.
- **Presence dock (avatar group) 도입은 별도 작업**. 본 hot fix 는 backend
  변경 없이 가능한 범위. design_upgrade.md §4.1 의 presence 는 wave 6+
  로 미룬다.

---

## 8. 측정

배포 후 가설 검증을 위한 가벼운 telemetry (optional):

- frontend 콘솔에 `console.timeStamp("ws-invalidate")` + 다음 paint 까지
  시간 (Performance Observer) — 플리커 frame 수
- WS broadcast 빈도 / 사용자별 fetch 빈도 (api 로그)
- 사용자 피드백: "동시 편집 중 깜빡임이 거슬리는가?" 정성

명시적 metric 도입은 보류, 정성 피드백 우선.
