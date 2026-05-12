# 경매내전 UI/UX 개선 계획서

> 마이너 업데이트 (v0.5.x 후속). 코드 변경 전 디자인 / 컴포넌트 / 정보 위계 합의용 문서.
> 작성: 2026-05-13. 기능 추가가 아닌 **reader 친화 정보 전달** 강화에 집중.

---

## 1. 원칙

### 1.1 Reader 중심 (핵심)

| 항목 | 시리즈 (일반 내전) | 경매내전 |
|---|---|---|
| 동시 participant | 10~10명 (시리즈당) | 10~20명 모집 + 보이스에서 관전자 多 |
| 화면 보는 사람 | 운영자 + 참가자 (해당 시리즈만) | **모든 참가자 + 관전자 동시** (의사결정에 모두 관여) |
| writer (입력) | 운영자 1명 | 운영자 1명 |
| reader 비중 | 5/10 | 19/20 (20인 기준) |

→ **reader 19명이 동시에 보는 화면**. writer-friendly (입력 편의) 보다 **reader-friendly (정보 전달, 시각화)** 가 우선.

### 1.2 효과적 정보 전달 — 구체 기준

| 정보 | 모든 시점 보여줘야 | 현재 상태 |
|---|---|---|
| 어느 단계인지 (전체 8단계 중) | ✅ 한눈에 | ⚠ 텍스트만 (`단계: BIDDING`) |
| 팀별 잔여 포인트 (BIDDING) | ✅ 시각화 | ⚠ 작은 텍스트 `잔 850p` |
| 팀 구성 진행률 (5명/팀 중 몇 명) | ✅ 시각화 | ⚠ 작은 텍스트 `2/5` |
| 현재 매물 (BIDDING) | ✅ 강조 | ⚠ 작은 텍스트 `📦 현재 매물: e` |
| 매치 스코어 / 진행 | ✅ 크게 | ✅ 어느 정도 (스코어 큼) |
| 우승 팀 (COMPLETED) | ✅ 화려하게 | ✅ trophy 카드 |
| 라인업 (매치 안에서 어떤 사람이 어느 팀?) | ✅ avatar 줄 | ⚠ 텍스트 ("정현이, 호민이...") |

### 1.3 비목표

- **새 기능 추가 X** — 현재 lifecycle 그대로
- **API 변경 X** — 응답 schema 그대로 (기존 fields 활용)
- **봇 채널 메시지 변경 X** — 이번 작업 외
- **모바일 첫 (스마트폰) 디자인 X** — Activity 는 Discord desktop / web 중심, 모바일 따로 wave

### 1.4 디자인 일관성

기존 시리즈 디자인 토큰을 **그대로 재사용**:

| 토큰 / 컴포넌트 | 역할 | 경매에서도 |
|---|---|---|
| `surface-base` | 메인 콘텐츠 카드 (불투명 base-200) | ✅ 그대로 |
| `surface-soft` | 보조 패널 / 섹션 (반투명 + 테두리) | ✅ |
| `surface-quiet` | 메타 정보 박스 | ✅ |
| `card-action` | 클릭 가능 카드 hover/focus | ✅ |
| `card-status-{waiting,progress,completed,me}` | 좌측 4px 의미 색상 | ✅ — `progress` = 진행 중 매치, `completed` = 종료 매치 |
| `UserAvatar` 컴포넌트 | 일관 표시 (소환사 아이콘 / discordId 해시 색) | ✅ — 모든 사용자 표시 위치 |
| 팀 색 | TEAM_1 = `info` (파랑) / TEAM_2 = `error` (빨강) | ✅ 일관 (4팀 토너먼트에서도 BLUE/RED 사이드는 매치 단위) |
| 팀장 식별 | n/a | 🆕 `badge-warning` "👑 팀장" (소환사 아이콘 ring-warning) |
| Hard fearless 표시 | F 배지 | ✅ 그대로 (매치 내 fearless 동일 적용) |

---

## 2. 현재 UI 진단 (화면별)

### 2.1 AuctionDraft — 단계 분기 화면

| 단계 | 현재 | 문제 |
|---|---|---|
| **CAPTAIN_PICK** | 후보 grid (btn 2열/3열) + 선택 카운터 텍스트 | 팀장 시각화 부족 — 누가 팀장인지 hierarchy 약함 |
| **POINT_ALLOC** | 팀장별 input field 한 줄씩 | 4팀 동등성 시각 X (총 4000p 분배 감 없음) |
| **BIDDING** | 매물 영역 + 4팀 입찰 행 + 팀 현황 grid + 유찰 list | **가장 큰 reader 친화 약점** — 작은 텍스트 위주, 시각적 위계 약함, 잔여 포인트 progress bar 없음, 팀원 avatar 없음 |
| **PLACEMENT** | (BIDDING 의 연장 — 별도 UI 없음, `allPlaced` 시 자동 토너먼트 진행 버튼) | OK |

### 2.2 AuctionBracket — 매치 진행 화면

| 부분 | 현재 | 문제 |
|---|---|---|
| 4강 매치 카드 | 스코어 큼 (✅) + 양 팀장 이름 | 팀원 라인업 안 보임 (collapse details 안), avatar X |
| 결승 매치 카드 | 동일 패턴 | 같음 |
| MatchSetup | 팀 button 으로 짝짓기 | 4강 bracket 시각 위계 부재 — "어떤 매치가 누구 vs 누구" 보고 매치업 결정해야 하는데 list 형태 |
| GameInputForm | 라인 자유 픽 (5개 select × 2팀) + BAN 5개씩 + 챔프 그리드 모달 | writer 친화 — reader 입장에선 영향 작음 (입력 중인 화면이라) |

### 2.3 AuctionResult — 종료 화면

| 부분 | 현재 | 문제 |
|---|---|---|
| 우승 팀 hero card | 🏆 + 팀명 + 멤버 텍스트 | avatar X, 트로피 임팩트 약함 |
| 팀 grid | 카드 4개 (또는 2개) — 텍스트 list | avatar 없음, 우승 팀 외 패자 팀들 차별화 약함 |
| 매치 결과 list | 매치별 carded, 게임 collapse | bracket 위계 표시 X (4강 둘 + 결승 시각적 연결 없음) |

---

## 3. daisyUI 컴포넌트 도입 / 강화

### 3.1 신규 도입

| 컴포넌트 | 용도 | 위치 |
|---|---|---|
| **`stats` / `stat`** | 큰 숫자 강조 — 잔여 포인트, 진행률, 남은 매물 | BIDDING 헤더 (전체 진행 현황) + 각 팀 카드 |
| **`steps`** | 전체 lifecycle 단계 표시 (CAPTAIN_PICK → POINT_ALLOC → BIDDING → BRACKET → COMPLETED) | AuctionDraft / Bracket 공통 헤더 — sticky |
| **`status`** | 라이브 dot — 운영자가 현재 입력 중 표시 | 매물 표시 옆 + 운영자 입력 추적 |
| **`timeline-horizontal`** | 4강 → 결승 bracket 시각화 | AuctionBracket / AuctionResult |
| **`tooltip`** | 팀원 avatar hover 시 displayName + 소속 정보 | BIDDING 의 팀 카드 |

### 3.2 강화

| 컴포넌트 | 현재 사용 | 강화 |
|---|---|---|
| `radial-progress` | 일반 시리즈의 라인 승률 도넛 | **팀별 잔여 포인트 도넛** (current / initial) — BIDDING / Bracket 양쪽 |
| `progress` | 미사용 | **팀 구성 진행률** (members.length / 5) — 각 팀 카드 |
| `badge` | 다양 사용 | 추가: `badge-warning` 👑 팀장 / `badge-info` BLUE 사이드 / `badge-error` RED 사이드 |
| `UserAvatar` | 다른 화면 다수 | **모든 팀원 표시 위치** — BIDDING 팀 카드 / Bracket 매치 카드 / Result hero |
| `breadcrumbs` | navbar ContextChip | 이미 있음 (`🎟️ 경매 #N › CAPTAIN_PICK` 같은 형태) — 단계 별 갱신 |

### 3.3 명시적으로 안 쓰는 것

| 컴포넌트 | 이유 |
|---|---|
| `chat` (대화 버블) | 입찰 흐름을 chat 형태로 표현하기엔 메타포 모호. 운영자 입력 후 정적이라 부적합. |
| `countdown` | 시간 제한 없음 (의도된 비목표) |
| `swap` | 토글 X |
| `drawer` | 모달이 더 자연 |

---

## 4. 화면별 개선안 (와이어프레임)

### 4.1 공통 헤더 (모든 단계)

```
┌─────────────────────────────────────────────────────────────┐
│ 🎟️ 경매내전 #12  •  20인 토너먼트                       ↻ │
│ ─────────────────────────────────────────────────────────── │
│  steps-horizontal:                                          │
│  ① 팀장 ──── ② 포인트 ──── ③ 경매 ──── ④ 토너먼트 ──── ⑤ 종료 │
│                            ●━━━━━ (현재)                    │
└─────────────────────────────────────────────────────────────┘
```

- `steps-horizontal` 로 lifecycle 5 단계 (사용자 친화 라벨로 단순화)
- 현재 단계 `step-primary`, 이전은 `step-success`, 이후는 default
- Sticky top — 스크롤해도 단계 항상 보임

### 4.2 BIDDING 단계 — 가장 큰 reader 강화 포인트

```
┌─────────────────────────────────────────────────────────────┐
│ stats (4분할):                                              │
│ ┌──────────┬──────────┬──────────┬──────────┐              │
│ │ 매물 풀  │ 배치 완료 │ 잔여 인원 │ 진행 매물 │              │
│ │   16     │   3/16   │    13    │    1     │              │
│ └──────────┴──────────┴──────────┴──────────┘              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 📦 현재 매물 (status-success animate-pulse "● LIVE")        │
│ ─────────────────────────────────────────────────────────── │
│   ┌────────────────────────────┐                            │
│   │   [Avatar lg]                │     🎲 다음 인원 (btn)    │
│   │      정현이                  │     유찰 / 다음으로       │
│   │   (display 큰 글자)          │                            │
│   └────────────────────────────┘                            │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┬──────────────────┐
│ 👑 팀1 — a       │ 👑 팀2 — b       │
│ [radial-progress │ [radial-progress │
│   850/1000  85%]  │   1000/1000 100%]│
│ ─────────────────│ ──────────────── │
│ [👤👤👤▢▢] 3/5  │ [👤▢▢▢▢] 1/5  │
│ progress 60%      │ progress 20%      │
│ ─────────────────│ ──────────────── │
│ [입찰: ___] [✓]  │ [입찰: ___] [✓]  │
│ [➕수동]          │ [➕수동]          │
└──────────────────┴──────────────────┘
(4팀 grid 2x2 — 20인 / 1x2 — 10인)

┌─────────────────────────────────────────────────────────────┐
│ 유찰 (3): badge col [j] [k] [l]                            │
└─────────────────────────────────────────────────────────────┘
```

핵심 개선:
- **stats** 로 전체 진행 한눈에 — reader 가 "지금 어디 정도 진행됐나" 즉시 파악
- **현재 매물 hero** — Avatar lg + 큰 displayName + `status` LIVE dot
- **팀 카드 안 radial-progress** — 잔여 포인트 시각화 (예: `current_points / initial_points * 100`)
- **팀 카드 안 progress** — 팀원 충족률 (members.length / 5 * 100)
- **팀원 avatar 줄** — 빈 슬롯은 placeholder 색
- **👑 팀장 표시** — captain 옆 badge + avatar ring

### 4.3 AuctionBracket — 토너먼트 진행

```
┌─────────────────────────────────────────────────────────────┐
│ 🎟️ 경매내전 #12 토너먼트                                    │
│ steps: ④ 토너먼트 (현재)                                    │
└─────────────────────────────────────────────────────────────┘

┌─── 4강 ──────────────────┐   ┌─── 결승 ────────┐
│                           │   │                  │
│ ┌─ 매치 1 ─────────────┐ │   │                  │
│ │ [a 팀]  3 : 1  [d 팀]│─┼──▶│ vs?              │
│ │ [👤👤👤👤👤]         │ │   │ (4강 결과 대기)  │
│ │ vs [👤👤👤👤👤]      │ │   │                  │
│ │ BO3 · 🏆 a팀 승       │ │   │                  │
│ └──────────────────────┘ │   │                  │
│                           │   │                  │
│ ┌─ 매치 2 ─────────────┐ │   │                  │
│ │ [b 팀]  - : -  [c 팀]│ │   │                  │
│ │ [👤👤👤👤👤]         │ │   │                  │
│ │ vs [👤👤👤👤👤]      │ │   │                  │
│ │ BO3 · IN_PROGRESS    │ │   │                  │
│ └──────────────────────┘ │   │                  │
└───────────────────────────┘   └──────────────────┘
```

핵심:
- **bracket 시각화** — `timeline-horizontal` 또는 grid 2 columns (4강 / 결승). 4강 매치에서 결승으로 화살표/연결선 — `→` 또는 CSS pseudo
- **매치 카드 안 팀원 avatar 줄** — UserAvatar size="sm" 5명/팀 × 2 = 10
- **card-status 토큰 활용** — IN_PROGRESS = `card-status-progress`, COMPLETED = `card-status-completed`
- **🏆 우승팀 badge** — 매치 완료 시 양 팀명 옆

### 4.4 AuctionResult — 종료 화면

```
┌─────────────────────────────────────────────────────────────┐
│ 🏆🏆🏆                                                       │
│       경매내전 #12 우승                                      │
│                                                              │
│       ┌───────────────────────┐                              │
│       │   [Avatar xl × 5]      │                              │
│       │   팀1 (caption: a)     │                              │
│       └───────────────────────┘                              │
│                                                              │
│       2승 0패 (BO3 결승: 3-1)                                │
└─────────────────────────────────────────────────────────────┘

[bracket 결과 — 4강 + 결승 timeline-horizontal]

[전체 팀 결과 — 4 cards, 우승 = border-success, 준우승 = border-info,
 4강 탈락 = surface-soft]

[게임별 picks/bans — 매치 collapse, 라인별 챔프 grid 재사용 (ChampCell)]
```

핵심:
- **trophy hero** — 큰 emoji + 팀원 avatar xl 5명 줄. 운영자가 보이스에서 "와아" 분위기에 적합
- **bracket 결과 시각화** — 진행 중 화면과 동일 컴포넌트 재사용
- **전체 팀 결과 비교** — 4팀이 한 화면, border 색으로 순위 시각
- **게임별 picks/bans** — ChampCell 그리드 재사용 (PickBan 의 게임 화면과 같은 디자인)

---

## 5. 정보 위계 (typography)

| 레벨 | 사용 | daisyUI / Tailwind |
|---|---|---|
| H1 | 페이지 타이틀 (`🎟️ 경매내전 #12`) | `text-xl font-bold` |
| H2 | 섹션 타이틀 (`📦 현재 매물`, `4강`) | `text-base font-bold` |
| H3 | 카드 타이틀 (`팀 1`) | `text-sm font-bold` |
| 큰 숫자 | 포인트, 스코어 | `stat-value` (`text-2xl/3xl font-bold tabular-nums`) |
| 본문 | 일반 텍스트 | `text-sm` |
| Caption | 보조 (`잔 850p`, 추가 정보) | `text-xs text-base-content/60` |

규칙:
- 큰 숫자는 항상 `tabular-nums` — 숫자 흔들림 방지
- 색은 의미 기반 (info=정보, success=완료, warning=주의, error=위험)
- 팀 색 (info/error) 은 1팀/2팀 또는 BLUE/RED 사이드에만 사용 (다른 의미 X)

---

## 6. 작업 phase (분할)

| Phase | 내용 | 추정 | 위험도 |
|---|---|---|---|
| **U1** 공통 헤더 — `steps-horizontal` 토너먼트 단계 | AuctionDraft / Bracket / Result 헤더 통합 + sticky | 1~2h | 낮음 |
| **U2** AuctionDraft BIDDING 강화 | stats 헤더 + 매물 hero + 팀 카드 (radial-progress + progress + avatar 줄) | 3~4h | 중 — 가장 큰 시각 변경 |
| **U3** AuctionDraft CAPTAIN_PICK / POINT_ALLOC 정리 | avatar grid + 포인트 분배 시각 (총 4000p) | 1~2h | 낮음 |
| **U4** AuctionBracket bracket 시각화 | 4강 + 결승 grid + 매치 카드 안 팀원 avatar 줄 | 3~4h | 중 — 새 레이아웃 |
| **U5** AuctionResult trophy hero + bracket 결과 | 큰 우승 팀 hero + 매치 결과 timeline | 2~3h | 낮음 |
| **U6** 검증 + 릴리즈 | typecheck/test/lint + ROADMAP + commit + deploy | 0.5h | — |
| **합계** | | **~10~15h** | |

phase 별 commit / release 가능 — 한 번에 묶음 release 도 OK (예: U1+U2 = 한 release, U3+U4+U5 = 다음). 합의 시 결정.

---

## 7. 의사결정 필요

| 항목 | 옵션 | 추천 |
|---|---|---|
| Steps 라벨 단순화 | (a) 5단계 (팀장/포인트/경매/토너먼트/종료) / (b) 7단계 (전체 lifecycle 그대로) | **(a)** — reader 친화, 핵심만 |
| Bracket 시각화 | (a) timeline-horizontal / (b) grid 2-cols + CSS 연결선 / (c) SVG | **(b)** — 가장 단순, daisyUI 만 |
| 팀장 강조 | (a) avatar ring-warning + 👑 badge / (b) 별도 큰 카드 / (c) `data-content` 위 superscript | **(a)** — 일관성 + 정보 밀도 |
| 잔여 포인트 시각화 | (a) radial-progress 도넛 / (b) progress bar 가로 / (c) stat 큰 숫자 | **(a) + (c)** — 도넛 (시각) + 큰 숫자 (정확값) 같이 |
| 모바일 (작은 화면) 대응 | (a) 4팀 2x2 grid → 1x4 stacking / (b) 작은 화면 hidden 옵션 | **(a)** — 모바일도 reader 시각 유지 |
| 분할 release | (a) U1~U6 한 번에 / (b) U1+U2 → U3~U5 → U6 분할 | **(b)** — 회귀 격리, 점진적 검증 |

---

## 8. 비목표 (이번 작업 범위 외)

- **새 기능** — 입찰 자동화 / 단계 자동 진행 / 챔프 추천 등
- **API 변경** — 응답 schema / endpoint 새로 X
- **봇 채널 메시지** — 모집 / 종료 카드 UI 변경 X (이전 phase 에 일관 유지)
- **모바일-first 디자인** — Activity 는 Desktop 중심 — 모바일 대응은 break-once-fix 정도
- **실시간 협업 시각화** — 픽밴 cursor presence 등은 별도 백로그 wave
- **새 db 컬럼** — schema 변경 0
- **권한 / 가드 변경** — 운영자만 입력, reader 는 단순 view — 동일

---

## 9. 검증 + 릴리즈 흐름

1. 각 phase 후 `pnpm typecheck && pnpm test`
2. `pnpm dev` 또는 실제 모집 만들어 사용자 흐름 walkthrough (이전 release 들의 root cause = 실제 흐름 미검증)
3. ROADMAP 갱신 (Phase 29~)
4. `pnpm deploy:vps` + slash redeploy 불필요 (UI 만 변경)
5. Activity navbar 의 버전 표시 (`v0.5.x`) 로 deploy 확인

---

## 10. 다음 단계

이 문서 합의 후:
1. §7 의사결정 항목 답변
2. phase U1 부터 진행 (또는 user 가 우선순위 지정)
3. 작업 중 추가 발견 사항은 본 문서에 inline 갱신

피드백 / 변경할 부분 알려주세요. 동의되면 U1 코드 작성 시작.
