# mookbot v2 Activity UI 전면 검토 리포트

작성일: 2026-05-14
범위: `apps/activity/src/**` 의 UI/UX/접근성/성능/구조

## TL;DR
구조와 디자인 토큰의 뼈대는 잘 잡혀 있으나 (perms context, WS+SWR, surface-* 토큰, ErrorBoundary, dialog 기반 모달), 그 위에 쌓인 화면 코드들이 (1) 토큰을 무시한 직접 클래스 사용, (2) 모바일 폭(≈360–480dp)에 대한 검증 부재, (3) SVG/테이블/카드의 키보드 접근성 누락, (4) Auction 두 파일의 mega-component 문제로 일관성과 신뢰성을 갉아먹고 있다. 우선 P0 6건만 잡아도 체감 품질이 크게 올라온다.

---

## P0 — 즉시 잡아야 하는 것 (6건)

| # | 위치 | 문제 | 처방 |
|---|---|---|---|
| 1 | `screens/Leaderboard.tsx:161–166` | `<tr onClick cursor-pointer>` — 키보드/스크린리더에서 행 클릭 불가 | `role="button" tabIndex={0} onKeyDown(Enter/Space)` 또는 행 전체 `<button>` 래핑. 동일 패턴 다른 테이블에도 확산 점검. |
| 2 | `screens/MiniGame/Ladder.tsx:382–394` | SVG `<g onClick>` 에 키보드 불가 | 진입 버튼만 HTML `<button>`으로 분리하거나 `role="button" tabIndex` + Enter/Space 처리. |
| 3 | `screens/SeriesResult.tsx:295–307, 320–325` | 픽/밴 챔프 이미지 `alt=""` — 결과를 보조기기로 알 수 없음 | `alt={champ.name}` 강제. `ChampCell`, `SlotTile`도 같은 점검 필요. |
| 4 | `screens/Result.tsx:15–17` | 스코어 `0:0` 하드코딩된 더미 화면이 빌드에 남아 있음 | 미사용이면 삭제. 사용 중이면 `SeriesResult`로 대체하거나 props 연결. |
| 5 | `screens/MiniGame/styles.css:28–40` 외 | `@keyframes` 가 `prefers-reduced-motion` 무대응 — 동전/원판/사다리 애니메이션 계속 돔 | `@media (prefers-reduced-motion: reduce) { animation: none; transition: none; }` 글로벌 가드. |
| 6 | `screens/Auction/AuctionBracket.tsx:119–166` | 브래킷이 `lg:` 미만에서 시각이 깨짐 — 4강/결승이 그냥 세로로 쌓여 토너먼트 구조가 안 보임 | 모바일은 (a) 탭/단계 분리, (b) horizontal scroll + sticky 결승, (c) 세로 SVG 트리 중 택1. |

---

## P1 — 강하게 권장 (영역별)

### A. 디자인 토큰 일관성 (전역)
index.css 의 `surface-base / soft / quiet`, `card-action`, `card-status-*` 가 정의돼 있는데 다수 화면이 토큰을 무시하고 `bg-base-200/40 border border-base-300` 등을 직접 작성.

- `screens/Profile.tsx:212, 223, 234, 260`
- `screens/SeriesResult.tsx:269–273`
- `screens/MiniGame.tsx:62`
- `screens/Auction/AuctionDraft.tsx:240, 297, 405, 628`
- `screens/Auction/AuctionBracket.tsx:281, 336, 634`
- `screens/RecruitmentList.tsx:250–268` 의 경매내전 카드만 `card-status-*` 미사용

처방: 토큰을 안 쓰는 패턴을 일괄 치환. 누락 토큰(`card-status-auction`) 1개 추가.

### B. 모바일 폭 (≈360–480dp) 검증 부재
`lg:` 기준 그리드가 많고, 그 미만에서 레이아웃이 잡혔는지 검증된 흔적이 없음.

- `screens/PickBan/PickBanBoard.tsx:396` — `lg:grid-cols-[3fr_2fr]` (그 아래는 1열 stack, OK 지만 `SlotTile` 절대 크기 `w-10/w-12` 가 좁은 폭에서 잘림 위험)
- `components/MeHero.tsx:152` — `grid grid-cols-5 gap-1.5` 고정 5열, 모바일 텍스트 깨짐
- `screens/Profile.tsx:266` — `max-h-[420px]` 하드코딩, 뷰포트 작을 때 과한 영역 점유
- `screens/Auction/AuctionBracket.tsx:986–1046` — `GameInputForm` 의 PICK 줄에 라인라벨+select+버튼 한 줄 강제 → truncate 폭주

### C. App.tsx 셸 비대 & 글로벌 단축키 분산
- `App.tsx:327–454` 의 stage 분기가 11개, 128줄.
- "?" 만 전역, 그 외 단축키(Esc, 1/2/3, Backspace)는 화면별로 산재 — HelpModal 의 단축키 목록(`HelpModal.tsx:11–16`)과 실제 구현 위치 불일치 → drift 위험.

처방: `StageRouter` 추출 + 단축키 맵을 단일 객체로 표면화, HelpModal 이 그 맵에서 자동 렌더.

### D. 동시 편집 / WS 동기화의 미세한 race
- `screens/EntryEditing/useEntryEditingState.ts:114–124` — `onApply` 에서 빈 incoming 도 적용. PUT 차단으로 막혔지만 로컬 화면 깜빡임 가능. incoming 이 empty 면 ignore.
- `screens/PickBan/PickBanBoard.tsx:250` — `setSearch("") → setActiveSlot(...)` 시 `searchRef.focus` 가 이전 slot 기준.
- `screens/PickBan/usePickBanState.ts:82–87` — set 직후 `lastSavedDraft` 가 이전 값으로 남아 WS 즉시 이벤트와 비교 실패 가능.
- `screens/Auction/useAuctionState.ts:50–56` — 본인이 친 mutation도 toast 가 본인에게 다시 뜸. broadcast 에 `updatedBy` 실어서 self-suppress.
- `screens/Auction/AuctionDraft.tsx:524–538` — `draw()` 직후 candidateUserId 가 바뀌어도 SWR 데이터는 이전 매물. `<CandidateRiotSection key={current?.userId}>` 로 강제 리셋.

### E. 모바일 DnD
- `screens/EntryEditing/SlotRow.tsx:54–56`, `ParticipantCard.tsx:24–37` — HTML5 DnD 만 사용. 터치 fallback(`tap-to-place`) 코드는 존재하나 모바일에서 자동 활성화 단서가 약함.

처방: `pointer: coarse` 미디어쿼리 또는 touch 감지 시 tap-mode 강제. 빈 슬롯에 명시적 "선택 후 탭" 힌트.

### F. 접근성 잔여
- 모달의 `returnFocus` 패턴 부재: `ChampPickerModal.tsx:25–36`, `HelpModal`, `PermsModal`.
- ARIA live region 누락: `components/Toaster.tsx:68–79` 에 `aria-live="polite" aria-atomic="true"` 추가.
- `radial-progress`/`progressbar` 에 `aria-label` 누락: `Profile.tsx LaneMmrCard 300–314`.
- focus ring 색상이 모두 `primary` 단색 — 픽밴/엔트리에서 TEAM_1/TEAM_2 구분에 활용 가능.

### G. Auction mega-component 분해
- `AuctionDraft.tsx` 880L: `CaptainPicker(242–362)` / `PointAllocator(367–492)` / `BiddingPanel(497–880)` 한 파일.
- `AuctionBracket.tsx` 1091L: `MatchSetup(193–293)` / `MatchCard(529–737)` / `GameInputForm(782–1091)` 한 파일.

처방: 단순 split 만 해도 P1.

### H. 성능 / 메모이제이션
- `useMemo` 누락: `Profile/MmrChart.tsx:94–111`, `SeriesResult.tsx:94–95 (champById)`, `MiniGame/Ladder.tsx:93–109 (buildPath)`, `Auction/AuctionBracket.tsx:544–560 (t1/t2 wins)`.
- `screens/PickBan/ChampCell.tsx` — `React.memo` 미사용.
- 이미지 lazy: `ChampCell.tsx:50`, `SlotTile.tsx:31` 에 `loading="lazy"` 누락.

---

## P2 — 폴리시

(아래 항목은 모두 완료됨 — 진행 상태 섹션 참고)
- `useStaleWhileRevalidate.ts:103–107` — `onApply` 의 try-catch 가 warn 만 함. 호출처에서 알 수 있게 surface.
- `Profile.tsx:138–143` — 아바타 폴백이 splash → icon 순서. 무거운 splash 가 먼저 → 순서 뒤집기.
- `EmptyState.tsx` — `cta: ReactNode` 보다 `cta: { label, onClick }[]` 가 호출처 깔끔.
- `ConfirmButton.tsx` — `title` 과 `disabledReason` 분리가 헷갈림. 단일 `tooltipText` 또는 `helpText`로 통합.
- `SearchBar.tsx:148` vs `App.tsx:235` — 같은 `z-30`. dropdown/popover 스택을 `z-30`, modal `z-50`, toast `z-50` 식으로 문서화.
- `WelcomeCard.tsx:114–121` — `FeatureChip` 의 button/div 혼합. 명시적 분리.
- `MyRiotAccounts.tsx` — useState 5개로 분산된 폼 상태를 reducer 또는 객체 1개로 통합. `useStaleWhileRevalidate` 패턴 미사용.
- 색상 분류 (`wrPct >= 60 ? "text-success" : ...`) 가 여러 곳 중복 — `utils/colorMap.ts:getWinRateColor()` 로 추출.
- 라운드 라벨("4강", "결승") 도 `Auction/AuctionBracket.tsx:626–631`, `AuctionResult.tsx:227–228` 중복.
- `Roulette.tsx` `labelRadius=110` 등 절대값 → `geom.radius` 비율로 변경.
- i18n: 한국어 하드코딩 (현 MVP 단계엔 acceptable). 메시지 상수 분리만 미리 해 두면 추후 비용 거의 0. — **보류** (MVP).

---

## 진행 상태

### P0
- [x] P0 #1 Leaderboard 행 키보드 접근성 (role="button" + tabIndex + Enter/Space + aria-label + focus ring)
- [x] P0 #2 Ladder SVG 키보드 접근성 (g 요소에 role/tabIndex/Enter+Space, focus-visible 시 circle stroke 로 포커스 링)
- [x] P0 #3 SeriesResult 이미지 alt (false positive — 이미 `alt={champ.name}` 적용됨)
- [x] P0 #4 Result.tsx dead code 처리 (삭제)
- [x] P0 #5 prefers-reduced-motion 가드 (index.css 글로벌 + MiniGame styles.css 별도 가드)
- [x] P0 #6 AuctionBracket 모바일 폴백 (lg 미만에서 ↓ "승자 진출" connector)

### P1
- [x] P1-A 디자인 토큰 일괄 치환 (`surface-base/soft/quiet/quiet-soft`, `card-action card-status-*` 일관화; `surface-quiet-soft` 토큰 신설)
- [x] P1-F 접근성 (Toaster aria-live polite + aria-atomic, ChampPickerModal returnFocus, Profile LaneMmrCard radial-progress aria-label)
- [x] P1-H 성능 (MmrChart rows / SeriesResult champById+wins / AuctionBracket t1/t2Wins / Ladder pathsByInput useMemo; ChampCell React.memo; ChampCell/SlotTile img loading=lazy)
- [x] P1-D WS race (AuctionDraft Candidate sections key reset; 그 외는 기존 보호장치 확인 — `!detail` PUT 가드, `originUser` self-suppress, `isLocalDirty` 체크로 충분)
- [x] P1-B 모바일 폭 (MeHero 5칸 폰트/패딩 sm 분기, Profile recent games max-h 50vh, AuctionResult 브래킷도 P0 와 동일 폴백)
- [x] P1-E 모바일 DnD (`useCoarsePointer` 훅 신설, 터치 환경에서 ParticipantCard/SlotRow draggable 비활성 + cursor-pointer; "또는 드래그" 안내문 분기)
- [x] P1-G Auction mega-component 분해
   - AuctionDraft.tsx 887L → 228L + (CaptainPicker 129L / PointAllocator 133L / BiddingPanel 405L)
   - AuctionBracket.tsx 1108L → 162L + (MatchSetup 208L / FinalSetup 139L / MatchCard 267L / GameInputForm 330L / _shared.ts 17L)
   - 기능/스타일/주석 변경 0. 316 tests pass.
- [x] P1-C 단축키 중앙화 (state/shortcuts.ts SoT 신설, HelpModal 이 import; 각 implementation site 에 SoT 참조 주석. App.tsx StageRouter 추출은 변경 위험 대비 가치가 작아 skip)

### P2
- [x] P2-1 SWR onApply 에러 surface (warn → error 로 격상, silent swallow 방지)
- [x] P2-2 Profile 아바타 폴백 icon→splash 순서로 (무거운 splash 먼저 로드 회피)
- [x] P2-3 EmptyState `cta: ReactNode` → `actions: {label,onClick,variant?}[]` 구조화
- [x] P2-4 ConfirmButton `title`/`disabledReason` → 단일 `tooltipText` 통합
- [x] P2-5 z-index 컨벤션 (10/20/30/50) 을 index.css 에 문서화
- [x] P2-6 WelcomeCard.FeatureChip 의 button/div 혼합 → FeatureChipButton/FeatureChipStatic 분리
- [x] P2-7 MyRiotAccounts 폼 상태 (3개 useState) → 단일 `linkForm` 객체로 통합
- [x] P2-8 winrate 색상 분류 `state/winrateColor.ts` 추출 (`winrateTextClass` / `winrateTextClassDim` / `winrateBadgeClass`). Profile/Leaderboard/MeHero/EntryEditing/BalancePreview 모두 일괄 치환
- [x] P2-9 라운드 라벨 (`4강`/`결승`/`매치`) → `types.ts roundLabel()` 단일 출처. AuctionBracket/AuctionResult 양쪽 사용
- [x] P2-10 Roulette labelRadius 절대값 110px → `calc(clamp(240px, 60vw, 360px) / 2 * 0.65)` 비율

### 최종 검증
- typecheck 통과 (errors 0)
- biome 검사: errors 0 / warnings 91 (모두 P1/P2 작업 전부터 존재하던 pre-existing a11y/structure 권고)
- vitest: 316 / 316 tests pass
