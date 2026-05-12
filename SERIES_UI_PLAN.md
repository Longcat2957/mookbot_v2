# 시리즈 내전 UI/UX 개선 계획서

> 마이너 업데이트 (v0.6.x 이후). **writer 중심** — 운영자 1명이 입력하는 화면 최적화.
> 작성: 2026-05-13. 기능 추가가 아닌 **writer-friendly 입력 가속** 강화에 집중.

---

## 1. 원칙

### 1.1 Writer 중심 (핵심)

| 항목 | 경매내전 (v0.6.0 wave) | 시리즈 내전 (이번 wave) |
|---|---|---|
| writer (입력) | 운영자 1명 | 운영자 1명 |
| reader 비중 | 19/20 (보이스 관전자 多) | 5/10 (해당 시리즈 참가자만, 보통 운영자 본인도 참가) |
| 입력 부담 | 매물 ~16~ + 매치 결과 | **게임당 20 슬롯 + 결과 — Bo3 시 최대 60+ 슬롯** |
| 입력 → 다음 입력 latency | 보이스 협의 후 입력 (느림 OK) | 픽밴은 실시간 진행 (빨라야 함) |

→ writer 1명이 **60+ 슬롯을 짧은 시간에 입력**. reader-friendly 의 시각 강조보다 **writer-friendly 입력 효율**이 우선. 글자 크기 키우는 일 X, **클릭 수 / 키 거리 / 인지 부담**을 줄임.

### 1.2 효과적 입력 — 구체 기준

| 동작 | 현재 인터랙션 | 목표 |
|---|---|---|
| 슬롯 1개 입력 | 슬롯 클릭 → 검색 → 챔프 클릭 = **~3 인터랙션** | 키보드만으로 가능 (`Tab` / 타이핑 / `Enter`) |
| Game 1 → Game 2 사이드 결정 | 처음부터 다시 BLUE/RED 클릭 | 이전 게임 반대로 자동 (토글로 끄기 가능) |
| 잘못된 픽 복구 | 슬롯 더블 클릭으로 삭제 | `Backspace` 또는 `Ctrl+Z` |
| 이전 게임 누가 뭐 픽했는지 참고 | 안 보임 (Hard Fearless 비활성화만) | 챔프 hover tooltip + 셀 위 `G1` 배지 |
| 결과 단계 (승자 + 시간) | 클릭 + 입력 + 클릭 = 3 단계 | `1` 또는 `2` → `Ctrl+Enter` |

### 1.3 비목표

- **새 lifecycle 추가 X** — Bo3 / 픽밴 / 라인 자유 그대로
- **API schema 변경 X** — 응답 그대로 (Bulk paste 도 client-side parsing)
- **봇 채널 메시지 변경 X** — 이번 wave 외
- **모바일 대응 X** — 경매내전과 동일. Discord Desktop / Web 만 가정
- **음성 인식 / OCR 자동화 X** — 사람이 입력하는 가정
- **다중 운영자 동시 편집 X** — 운영자 1명 가정 (현재 `SaveStatusIndicator` 로 충돌만 표시)
- **AI 챔프 추천 / 자동 픽 X** — 입력 가속이지 자동 결정이 아님
- **밀도 변경 X** — daisyUI 표준 밀도 유지 (셀 크기 / 그리드 행 수 / 카드 padding 그대로)
- **대시보드형 전면 재구성 X** — 카드 stack 구조 유지. 다음 항목은 OK ↓

### 1.4 디자인 변경 — OK 범위

이번 wave 는 **layout 일부 변경 + 컴포넌트 톤 강화** OK (이전 plan 의 "톤 유지" 원칙에서 풀림 — 사용자 결정 2026-05-13).

- ✅ **픽밴 화면 split layout** — 보드 좌 60% + 챔프 그리드 우 40% sticky (한 화면 동시 가시)
- ✅ **컴포넌트 톤 강화** — 챔프 셀 / 슬롯 타일 / 사이드 결정 카드 / 결과 패널 시각 강화 (ring / glow / 명확한 상태 색)
- ✅ **사이드 색 강화** — BLUE/RED 배경 tint, 1팀/2팀 일관 info/error 토큰
- ✅ **단계 진행 시각화** — 결과 N/4 텍스트 → daisyUI `steps`
- ⚠ **기존 토큰 유지** — `surface-base/soft/quiet`, `UserAvatar`, `sideTextColor`, 팀 색 정의 자체는 그대로. 사용 위치 / 강도만 강화.

---

## 2. 현재 UI 진단 (writer 입장)

### 2.1 RecruitmentList (대시보드)

| 부분 | 현재 | writer 관점 |
|---|---|---|
| 모집/시리즈 카드 클릭 진입 | ✅ 1 클릭 | OK |
| 페이지네이션 | 화살표 클릭 | 키보드 `←` `→` 없음 (개선 우선순위 낮음) |
| 새 모집 시작 | 봇 슬래시 (`/모집`) | 별도 동선 OK |

→ writer 가 자주 하는 동작 아님 — 이번 wave 변경 우선순위 낮음.

### 2.2 EntryEditing — 팀 배치

| 부분 | 현재 | writer 관점 |
|---|---|---|
| Tap-to-Place | ✅ 후보 → 슬롯 클릭 | OK |
| Drag&Drop | ✅ | OK |
| 좌/우 swap | ✅ 한 클릭 | OK |
| **자동 라인 배치 시드** | ❌ | **개선** — `mainRole` / 라인별 MMR 기반 1차 자동 분배 버튼 |
| **Undo / Redo** | ❌ | **개선** — 잘못 배치 후 직전 상태 복원 |
| **키보드 단축키** | ❌ | **개선** — 후보 선택 후 `1~5` = TEAM_1 라인, `Shift+1~5` = TEAM_2 |

### 2.3 PickBan + PickBanBoard (핵심 writer 화면)

이미 있는 것 (writer 친화 — 유지):

- ✅ `/` 키로 검색 input focus
- ✅ `Esc` 검색 클리어 / 활성 슬롯 해제
- ✅ 슬롯 클릭 시 검색 input 자동 focus
- ✅ MY MAINS 섹션 (활성 픽 슬롯 플레이어 주력 챔프 상단 분리)
- ✅ Hard Fearless 이전 게임 사용 챔프 자동 비활성
- ✅ BulkInput (콤마/공백 split parsing)
- ✅ tabs (Game 1/2/3) + 게임 결과 badge
- ✅ BalancePreview Game 1 자동 표시

부족 (개선 대상):

| 항목 | 현재 | 개선 |
|---|---|---|
| 챔프 선택 → 다음 슬롯 자동 이동 | 슬롯 해제만, 다음 슬롯 수동 클릭 | **자동 advance** (토글) |
| 검색 후 `Enter` 로 첫 챔프 선택 | 클릭만 가능 | **`Enter` 첫 챔프 선택 + advance** |
| `Tab` 다음 슬롯 | ❌ | **`Tab` / `Shift+Tab` 다음/이전 슬롯** |
| `Backspace` 활성 슬롯 비우기 | ❌ (슬롯 더블 클릭으로만 가능) | **`Backspace` 삭제** |
| 사이드 단축키 (B / R) | ❌ | **`B` / `R` 1팀 BLUE / RED** |
| Game 탭 단축키 | ❌ | **`Ctrl+1/2/3`** |
| 이전 게임 픽 참고 | Hard Fearless 비활성만 | **챔프 셀 위 `G1` 배지 + hover tooltip** "G1 1팀 MID 픽 (W)" |
| Bulk paste robust 화 | 콤마/공백 split | Discord 봇 로그 한 줄 paste 지원 (`@user picks X mid`) |

### 2.4 ResultPanel — 결과 입력

| 부분 | 현재 | writer 관점 |
|---|---|---|
| 4단계 진행 표시 (사이드/밴/픽/승자) | ✅ "N/4 단계 완료" | OK |
| 승자 큰 카드 2개 (라인업 표시) | ✅ | OK — 라인업 확인 동시 |
| 게임 시간 input | optional | OK |
| **승자 단축키 (`1` / `2`)** | ❌ | **개선** |
| **`Ctrl+Enter` 기록** | ❌ | **개선** |

---

## 3. 신규 기능 / 강화

### 3.1 키보드 우선 입력 (W1, 핵심)

**픽밴 보드 단축키 표:**

| 키 | 동작 | 활성 조건 |
|---|---|---|
| `/` | 검색 input focus | 항상 (이미 있음) |
| `Esc` | 검색 클리어 → 활성 슬롯 해제 | 항상 (이미 있음) |
| `Enter` | 검색 결과 첫 챔프 선택 + 다음 슬롯 advance | 검색 input focus 중 |
| `Tab` | 다음 슬롯 (1팀 BAN1 → ... → BAN5 → 2팀 BAN1 → ... → 2팀 PICK5) | 슬롯 활성 중 |
| `Shift+Tab` | 이전 슬롯 | 슬롯 활성 중 |
| `Backspace` | 활성 슬롯 챔프 삭제 | 슬롯 활성 + 검색 input 빈 상태 |
| `B` / `R` | 1팀 사이드 BLUE / RED | 사이드 미결정 + 검색 input non-focus |
| `1` / `2` | 결과 단계 — 승자 1팀 / 2팀 | 결과 입력 중 |
| `Ctrl+Enter` | 결과 기록 (모든 조건 충족 시) | 결과 입력 중 |
| `Ctrl+1/2/3` | Game 1/2/3 탭 전환 | 항상 |
| `Ctrl+Z` | 직전 슬롯 변경 undo (게임 결과 기록 전까지) | 항상 |

**IME 충돌 주의** — 한글 자모 조합 중 `Enter` / `Tab` 은 IME 가 가로채는 경우 있음. `compositionend` 이후만 단축키 발동.

### 3.2 자동 슬롯 advance (W2)

기본 동작: 챔프 선택 후 같은 BAN / PICK 카테고리 안에서 다음 빈 슬롯으로 자동 이동.

```
1팀 BAN1 [X] 입력 → 1팀 BAN2 자동 활성
1팀 BAN5 입력 → 2팀 BAN1 자동 활성 (이미 비어 있으면)
모든 BAN 채워짐 → 1팀 PICK1 자동 활성
```

토글 위치: 활성 슬롯 안내 alert 안에 daisyUI `toggle` — `자동 다음 슬롯 ☑`. localStorage 영속.

순서 옵션 (드롭다운):

- **자유** (default) — BAN 5×2 → PICK 5×2, 단순히 다음 빈 슬롯
- **LoL 표준 (10밴 → 10픽)** — Blue BAN1 → Red BAN1 → ... → Blue PICK1 → Red PICK1/2 → ...

LoL 표준은 운영자가 정식 토너먼트 진행 시만. default 자유.

### 3.3 이전 게임 픽 정보 표시 (W3)

Game 2 / 3 입력 시 챔프 셀에 추가 정보:

```
┌──────────┐
│ [icon]   │  ChampCell
│ Jax  G1  │  ← 우상단 배지 "G1" (이미 1게임에서 사용됨)
└──────────┘
```

Hover tooltip:
```
Jax · G1 1팀 MID 픽 (1팀 W)
이번 게임 사용 가능
```

또는 fearless 비활성:
```
Jax · G1 1팀 MID 픽
🛡️ Hard Fearless 비활성
```

데이터 소스: `detail.games[]` — gameNumber + team + role + championId 전부 있음. derived map 으로 처리.

### 3.4 자동 사이드 반전 (W4)

Game 2 / 3 진입 시 이전 게임 사이드의 반대로 자동 (default ON). 운영자가 변경 시 토글 OFF.

```
Game 1: 1팀 BLUE / 2팀 RED 결정 → 기록
Game 2 진입 → 1팀 RED / 2팀 BLUE 자동 (default)
운영자가 BLUE 로 다시 바꾸면 OK — 자동 반전은 default 일 뿐 강제 X
```

토글: 사이드 결정 카드 안 `이전 게임 반대 ☑`. localStorage 영속.

### 3.5 EntryEditing 자동 라인 배치 + Undo (W5)

**자동 라인 배치 시드:**

후보 풀 상단에 `🎯 라인 자동 배치` 버튼. 클릭 시:

1. 각 참가자의 `mainRole` (`participant.mainRole`) 또는 라인별 MMR 최고값 기반으로 1차 분배
2. BalancePreview 의 결과 시드 (이미 백엔드에 시드 알고리즘 있다면 재사용)
3. **운영자가 미세 조정** — 자동 분배는 시작점, 운영자 의도 무시 X

추가 셔플 버튼 `🎲 다시 분배` — 다른 시드로 재실행.

**Undo / Redo:**

EntryEditing / PickBan 에 세션 단위 undo stack (메모리 only — 새로고침 시 reset).
- `Ctrl+Z` undo / `Ctrl+Shift+Z` redo
- depth 제한 ~20
- entry assignment 변경 / pick & ban 슬롯 변경 단위

### 3.6 키 hint 패널 (W6)

화면 하단 또는 활성 슬롯 alert 우측에 `kbd` 콜렉션:

```
⌨️ <kbd>/</kbd> 검색 · <kbd>Tab</kbd> 다음 · <kbd>Enter</kbd> 첫챔프 ·
    <kbd>Backspace</kbd> 삭제 · <kbd>B</kbd>/<kbd>R</kbd> 사이드 ·
    <kbd>1</kbd>/<kbd>2</kbd> 승자 · <kbd>Ctrl</kbd>+<kbd>Enter</kbd> 기록
```

처음 본 사용자도 발견 가능 — collapse default OPEN (한 줄), 사용자가 close 후 localStorage 영속.

### 3.7 PickBan split layout (D1)

현재 vertical (보드 위 + 챔프 그리드 아래 scroll) → **좌 60% 보드 + 우 40% 챔프 그리드 sticky** (lg breakpoint 이상). 슬롯 클릭 후 챔프 검색 / 선택 시 스크롤 없이 한 화면에서 처리.

```
┌──────────────────────────────────────┬───────────────────────┐
│ [활성 슬롯 alert + steps]            │ [검색 input  + ✕]      │
│ ────────────────────────             │ ─────────────────────  │
│ 1팀 (BLUE)        2팀 (RED)          │  🌟 MY MAINS           │
│ BAN [□][□][□][□][□]                 │  [chmp grid auto-fill] │
│ PICK [□][□][□][□][□]                 │  ─────────             │
│ ────────────────────                 │  전체 사용 가능         │
│ (반대 팀 동일)                        │  [grid sticky scroll]  │
│ ────────────────────                 │  ─────────             │
│ [결과 단계 progress] [기록]           │  사용 불가 (collapse)   │
└──────────────────────────────────────┴───────────────────────┘
```

- lg+ 만 split, md 이하는 현재 vertical 유지 (실제로는 Desktop only 라 항상 split)
- 그리드 우측 컬럼은 `sticky top-2 h-[calc(100vh-4rem)]` — 스크롤 독립
- BAN/PICK 그루핑 강화 (boards 좌측에)

### 3.8 컴포넌트 톤 강화 (D2)

**ChampCell (챔프 셀):**
- 현재: icon + 이름 text-[10px] + disabled 시 grayscale
- 강화: 활성 슬롯 있을 때 hover 시 `ring-2 ring-primary` glow + transform scale-105. 사용 불가 (used/fearless) 시 더 명확한 시각 분리 (red diagonal overlay 또는 lock icon)
- 사용 상태 4종 토큰 일관: `usable` (default) / `mains` (yellow ring) / `used` (faded + red dot) / `fearless` (faded + shield icon)

**SlotTile (슬롯 타일):**
- 현재: 빈 슬롯 = 빈 셀 / 채워짐 = 챔프 icon + 이름
- 강화: 활성 슬롯 = `ring-2 ring-primary animate-pulse` + glow. 채워진 슬롯 hover 시 ✕ 삭제 cue. 빈 슬롯 hover 시 "+" cue + tooltip "Tab 으로 다음 슬롯 / 클릭으로 활성화"

**Side decision card (사이드 결정):**
- 현재: BLUE/RED 텍스트 큰 버튼 2개 (이미 있음)
- 강화: 배경 사이드 색 tint (BLUE = info bg-info/10 / RED = error bg-error/10), 결정 후 작은 inline 줄 → 양 팀 배지 표시 (`badge badge-info BLUE` / `badge badge-error RED`)

**Result panel (결과 입력):**
- 현재: 작은 "N/4 단계 완료" 텍스트 + 큰 카드 2개 + input + button
- 강화: 상단 `steps` (사이드 → 밴 → 픽 → 승자) horizontal — 4단계 시각화. 승자 카드에 큰 `1`/`2` kbd badge.

**TeamColumn (BAN/PICK 그루핑):**
- 현재: BAN 5 + PICK 5 stack
- 강화: BAN 영역 (`bg-warning/5` 배경 tint + 🚫 라벨) / PICK 영역 (`bg-success/5` 배경 tint + ⚔️ 라벨) 시각 분리. 사이드 색 (BLUE/RED) 은 column header 좌측 4px border.

---

## 4. 화면별 변경 (와이어프레임)

### 4.1 활성 슬롯 안내 alert 확장

**현재 (참고):**
```
🎯 1팀 밴 #2 — 챔프 선택 또는 슬롯 다시 클릭 (Esc 취소)  [✕]
```

**개선:**
```
┌─────────────────────────────────────────────────────────────┐
│ 🎯 1팀 BAN #2  · 자동 다음 슬롯 [☑]  · 순서: [자유 ▾]  [✕] │
│ ⌨️ /  검색   Tab  다음   Enter  첫챔프   Backspace  삭제    │
└─────────────────────────────────────────────────────────────┘
```

- 활성 슬롯 라벨 (이미 있음) + 토글 추가
- 단축키 hint 아래 한 줄 (kbd badge)
- daisyUI `alert alert-info alert-soft` 유지

### 4.2 검색 input → Enter 가속

```
┌────────────────────────────────────────────────────┐
│ [검색: jax_______] [✕]  → 다음: 자르반 4세 [Enter]  │
└────────────────────────────────────────────────────┘
```

- 검색어가 1자 이상이면 우측에 첫 챔프 인라인 미리보기 (작은 텍스트 + kbd Enter)
- Enter 시 첫 챔프 선택 + 다음 슬롯 advance

### 4.3 챔프 셀 G1 / G2 badge

```
┌──────────────────┐
│ [champ icon]  G1 │   ← 우상단, badge-xs, 이미 사용됨 표시
│   Jax  ⭐3       │      ⭐ = mainCount (MY MAINS 일 때)
└──────────────────┘
```

- 우상단 `G1` `G2` badge — daisyUI `badge badge-xs badge-ghost`
- hover tooltip 으로 상세 (어느 팀, 어느 라인, 결과)

### 4.4 ResultPanel 단축키 노출

```
┌─── Game 1 결과 입력 ──────────────────┐
│  [TEAM_1 라인업]  [TEAM_2 라인업]      │
│   ↑ 클릭 또는 ⌨️ 1           ↑ ⌨️ 2  │
│  ─────────────────────────────────────│
│  게임 시간: [    ] 분 (선택)           │
│  ────────────                          │
│  [⌨️ Ctrl + Enter →  Game 1 기록]     │
└────────────────────────────────────────┘
```

- 승자 카드에 큰 `1` / `2` kbd badge
- 기록 버튼에 `Ctrl + Enter` kbd badge

### 4.5 EntryEditing — 자동 배치 + Undo

```
┌─── 후보 풀 · 10명 미배정 / 총 10명 ────────────────┐
│ [🎯 라인 자동 배치]  [🎲 다시]  [↶ Ctrl+Z]          │
│ ─────────────────────────────────────────────────│
│ [참가자 카드 grid]                                 │
└────────────────────────────────────────────────────┘
```

---

## 5. daisyUI 컴포넌트

### 5.1 신규 / 강화

| 컴포넌트 | 용도 | 위치 |
|---|---|---|
| **`kbd`** | 모든 키보드 단축키 표시 (`/`, `Tab`, `Enter`, `B`, `R`, `1`, `2`, `Ctrl+Enter` 등) | 활성 슬롯 alert / ResultPanel 버튼 / 키 hint 패널 |
| **`toggle`** | 자동 advance / 자동 사이드 반전 boolean | 활성 슬롯 alert 안 |
| **`tooltip`** | 챔프 hover 시 이전 게임 사용 정보 | 챔프 셀 |
| **`dropdown`** | 순서 모드 (자유 / LoL 표준) | 활성 슬롯 alert 안 |
| **`badge` (badge-xs ghost)** | 챔프 셀 우상단 G1/G2 사용 표시 | ChampCell |

### 5.2 명시적으로 안 쓰는 것

| 컴포넌트 | 이유 |
|---|---|
| `modal` | 입력 끊김 — 절대 X |
| `drawer` | 사이드 패널 X (좁아짐) |
| `carousel` | 비목적 |
| `stats` 큰 숫자 | reader 강조용 — writer 화면엔 부적합 |

---

## 6. 정보 위계 (writer 차이)

writer 화면은 **시각보다 동작** 우선. 글자 크기는 경매내전 만큼 키우지 않음.

| 레벨 | 현재 (시리즈) | writer (이번 wave) |
|---|---|---|
| H1 페이지 타이틀 | `text-xl` | **유지 `text-xl`** |
| 슬롯 라벨 (BAN #1, TOP) | `text-xs ~ sm` | **유지** — 시각 보조, 키로 점프 |
| 챔프 셀 이름 | `text-[10px]` | **유지** — 그리드 밀도 우선 |
| 활성 슬롯 안내 | `text-sm + 작은 hint` | **개선** — `kbd` badge 강조 |
| 단축키 hint | n/a | **추가** `kbd kbd-sm` 일관 |
| 결과 카드 (1팀/2팀) | text-base | **유지** — 라인업 표시 우선 |

규칙:
- 글자 크기보다 **상호작용 속도** 가 핵심
- 활성 상태 cue 는 색 (info/warning) + `kbd` badge 로 명확
- 클릭 영역은 충분히 크게 유지 (실수 줄이려) — `min-h-12` 정도
- 픽밴 그리드 밀도는 줄이지 않음 (한 화면에 모든 챔프 보여야)

---

## 7. 작업 phase

| Phase | 내용 | 추정 | 위험도 |
|---|---|---|---|
| **W1** PickBan 키보드 단축키 핵심 (`Tab` / `Enter` / `Backspace` / `B`/`R` / `1`/`2` / `Ctrl+Enter` / `Ctrl+1~3`) | useKeyboardShortcuts hook + IME compositionend 처리 + PickBanBoard / ResultPanel 통합 | 4~5h | 중 — IME 충돌, 검색 input focus 분기 |
| **W2** 자동 advance + 순서 모드 토글 (자유 / LoL 표준) | 다음 슬롯 계산 함수 + localStorage 영속 | 2~3h | 중 — LoL 표준 edge case |
| **W3** 이전 게임 픽 표시 (`G1` 배지 + hover tooltip) | gameHistory map + ChampCell 확장 | 2h | 낮음 |
| **W4** 자동 사이드 반전 (Bo3) | 새 게임 진입 시 default 반전 토글 + localStorage | 1h | 낮음 |
| **W5** EntryEditing 자동 라인 배치 시드 + Undo/Redo | BalancePreview 결과 활용 + history stack hook | 3~4h | 중 — 자동 배치 알고리즘 |
| **W6** 키 hint 패널 (kbd collection 컴포넌트) | KeyboardHints 공통 컴포넌트 | 1~2h | 낮음 |
| **D1** PickBan split layout (보드 좌 60% + 그리드 우 40% sticky) | PickBan.tsx / PickBanBoard.tsx grid lg:grid-cols-[3fr_2fr] + sticky 그리드 | 3~4h | 중 — sticky 높이 계산, 활성 슬롯 안내 sticky 위치 |
| **D2** 컴포넌트 톤 강화 (ChampCell / SlotTile / 사이드 카드 / Result steps / TeamColumn 그루핑) | 시각 강화 — daisyUI steps 추가 + ring/glow + 사이드 tint + BAN/PICK 영역 색 분리 | 4~5h | 중 — 상태 색 일관성 / hover 충돌 |
| **W7** 검증 + 릴리즈 v0.7.0 | typecheck/test/lint + ROADMAP + commit + deploy | 0.5h | — |
| **합계** | | **~20~26h** | |

분할 release 폐기 — **W1~D2 한 번에 v0.7.0** (§8 결정).

---

## 8. 의사결정 (2026-05-13 결정)

| 항목 | 결정 |
|---|---|
| 자동 advance 기본값 | **항상 ON** — writer 가속 최우선, 토글로 끄기는 가능 |
| 순서 모드 기본값 | **자유** — 시리즈 내전 통상 패턴. LoL 표준은 드롭다운 옵션 |
| 이전 게임 픽 표시 방식 | **셀 배지 G1/G2 + hover tooltip** — 즉시 인지 + 상세 |
| IME 한글 입력 중 `Tab`/`Enter` 처리 | **compositionend 후 동작** (`isComposing` 체크) |
| Undo stack 영속 | **메모리 only** — 새로고침 시 reset, 단순 |
| 자동 라인 배치 시드 소스 | **BalancePreview 백엔드 재사용** — 기존 알고리즘 |
| 분할 release | **W1~D2 한 번에 v0.7.0** — 단일 minor bump |
| 디자인 변경 범위 | **컴포넌트 톤 강화 + 픽밴 split layout** — 대시보드형 전면 재구성 X |
| 픽밴 화면 layout | **split (보드 좌 60% + 그리드 우 40% sticky)** |
| 정보 밀도 | **현재 유지** — daisyUI 표준 밀도, 셀/카드 크기 그대로 |

---

## 9. 검증 + 릴리즈 흐름

1. 각 phase 후 `pnpm typecheck && pnpm test`
2. **실제 시리즈 만들어 픽밴 walkthrough — 키보드만으로 한 게임 완주 가능한지 확인** (가장 중요. UI 변경의 결과 검증 = 실제 입력 흐름 미검증 시 의미 없음)
3. ROADMAP 갱신 (Phase 30~)
4. `pnpm deploy:vps`
5. Activity navbar 의 버전 표시로 deploy 확인

---

## 10. 비목표 (재명시)

- **음성 인식 / OCR** — writer 가 직접 입력
- **다중 운영자 동시 편집** — 운영자 1명 가정
- **AI 챔프 추천** — 입력 가속이지 자동 결정이 아님
- **모바일 키보드 단축키** — 데스크탑 가정
- **새 lifecycle / 새 단계** — Bo3 / 픽밴 / 결과 그대로
- **시각 디자인 톤 변경** — daisyUI / surface-* 토큰 유지

---

## 11. 다음 단계

이 문서 합의 후:
1. §8 의사결정 항목 답변
2. phase W1 부터 진행 (또는 user 가 우선순위 지정)
3. 작업 중 추가 발견 사항은 본 문서에 inline 갱신

피드백 / 변경할 부분 알려주세요. 동의되면 W1 코드 작성 시작.
