# Activity Design Upgrade Plan (v2)

> v1 은 "시각 일관성" 중심이었다. v2 는 사용자가 실제로 겪는 흐름 — 음성 채팅으로
> 9 명이 기다리는 가운데 운영자가 픽/밴을 입력하는 그 순간 — 을 출발점으로 삼아
> **인지 부하 / 협업 / 회복력 / 모바일** 을 1급 관심사로 끌어올렸다.
>
> daisyUI 의 간결함을 유지하되, "예쁘다" 는 부수 효과로 두고 **실수를 줄이고
> 속도를 높이는** 디자인을 목표로 한다.

---

## 0. v1 → v2 변경 요약

| 영역 | v1 | v2 |
|---|---|---|
| 출발점 | 화면별 시각 정돈 | 사용자 여정 + 시나리오 |
| 다중 운영자 | 언급 없음 | Presence / 변경 알림 / 충돌 회복 1급 |
| 모바일/터치 | 반응형 폭만 | DnD 대체 입력(tap-to-place) 명시 |
| 챔피언 선택 | "모달로 옮기자" | **인라인 유지 + 정렬/필터/추천 강화** (현재 패턴이 클릭 비용 면에서 우월) |
| 위험 액션 | dropdown 으로 숨김 | 2-click 가시화 + 시각 카운트다운 |
| 관전(read-only) | "권한 안내" | 별도 정보 가치를 가진 라이브 뷰로 재설계 |
| 시스템 상태 | 미언급 | WS 연결 / 저장 / 동기화 상태를 navbar 1곳에 통합 |
| 온보딩 | 빈 카드 텍스트 | 빈 상태가 다음 액션을 가르치는 **튜토리얼 카드** |
| 색맹 | 언급 없음 | 색 + 모양 + 텍스트의 3중 인코딩 명시 |

---

## 1. UX 원칙

도메인 특화 5 + Nielsen 보강 5.

1. **현재 해야 할 일은 하나만 강조한다.** 그 외 액션은 시각적으로 한 단계 낮춘다.
2. **컬러는 의미를 가진다.**
   - 1팀 = `info` · 2팀 = `error`
   - BLUE 사이드 = `info` · RED 사이드 = `error`
   - 1팀-RED / 2팀-BLUE 조합에서도 **사이드 색이 우선**, 팀 라벨은 텍스트로 명시
3. **색만으로 정보를 전달하지 않는다.** 모든 색 신호는 (모양 + 라벨) 동반.
4. **확인보다 취소 가능성을 우선한다.** 가능한 모든 액션은 undo. 2-click confirm 은 undo 가 불가능한 액션에만 한정.
5. **시스템 상태는 항상 보인다.** 저장 / 동기화 / 권한 / 다른 운영자 활동.
6. **인식 > 회상.** 챔프는 항상 아이콘 + 이름, 라인은 아이콘 + 라벨, 팀은 색 + 라벨.
7. **빈 상태는 다음 액션을 가르친다.** 정적 메시지가 아니라 onboarding step.
8. **에러는 회복 가능해야 한다.** "다시 시도", "되돌리기", "그대로 진행" 옵션 명시.
9. **모바일이 동등 시민.** 모든 인터랙션은 터치 단독으로 완결되어야 함.
10. **속도는 디자인 요구사항이다.** 픽/밴은 분 단위로 끝나야 한다 — 클릭 수 / 스크롤 양을 측정 가능한 지표로 둔다.

---

## 2. 사용자 페르소나 & 핵심 여정

### 2.1 페르소나

- **운영자 A (호스트)** — 매주 내전을 주최. 흐름을 외우고 있음. **속도** 가 가장 중요.
- **운영자 B (대리 운영)** — A 가 자리를 비웠을 때 대신 입력. 흐름을 잘 모름. **명료성** 이 가장 중요.
- **참가자 C (관전)** — 대기 중인 다른 참가자. 진행 상황을 보고 싶음. **읽는 즐거움** 이 중요.
- **신규 D (첫 사용)** — 처음 운영자 권한을 받음. **온보딩** 이 중요.

### 2.2 핵심 여정 (Critical User Journeys)

#### CUJ-1: 모집 마감 → 시리즈 시작 (운영자 A, 빠른 길)
```
대시보드 진입 → "엔트리 대기" 카드 1 개 클릭
 → 슬롯 보드에 자동 배치된 초안 (history.topRole 기반)
 → 1~2 명만 수정
 → 엔트리 제출 → 픽/밴 화면
```
**KPI**: 클릭 ≤ 5, 시간 ≤ 30 초.

#### CUJ-2: Game 1 픽/밴 입력 (운영자 A)
```
사이드 결정 (1탭) → 밴 5 × 2 = 10 클릭 (각 슬롯 → 챔프 검색 → 선택)
 → 픽 5 × 2 = 10 클릭
 → 결과 입력 (승자 선택 + 제출)
```
**KPI**: 클릭 ≤ 25 (현재), 시간 ≤ 90 초.
**Pain points**:
- 챔프를 놓친 경우 다시 클릭하려면 슬롯 → 챔프 다시 검색
- "방금 누가 픽했지?" → 풀 스크롤로 찾아야 함
- 잘못 클릭 시 즉시 취소가 어려움

#### CUJ-3: 다른 운영자가 같은 슬롯을 동시에 편집 (A + B)
```
A: TEAM_1_TOP 에 Bob 배치
B: 동시에 TEAM_1_TOP 에 Charlie 배치
 → 마지막 쓰기 승. 둘 다 자기 화면에서 자기 변경이 적용된 것처럼 보이지만,
   서버는 후자 적용. WS reload 시점에 한쪽이 "어? 누가 바꿨지?" 경험
```
**Pain points**: 누가 바꿨는지, 언제, 무엇을 바꿨는지 모름.

#### CUJ-4: Activity 재실행 (네트워크 끊김 후 복귀)
```
Discord Activity 새로고침 → 자동 인증 → 진행 중 시리즈 자동 복원
 → "어디까지 했지?" 즉시 파악 필요
```
**Pain points**: 복원되었다는 사실이 시각적으로 드러나지 않음. 로컬 미저장 변경이 있었는지 모름.

#### CUJ-5: 모바일 터치만으로 엔트리 작성 (B, 출장 중)
```
Discord 모바일에서 Activity → DnD 동작 안함 → 멈춤
```
**Pain points**: HTML5 DnD 는 터치에서 불안정. 현재 대체 입력 없음.

#### CUJ-6: 신규 운영자 첫 사용 (D)
```
대시보드 진입 → "엔트리 대기" 카드 클릭 → 슬롯 보드 → 무엇을 해야 하는지 모름
```
**Pain points**: 슬롯 / 후보풀의 관계, DnD 가능성, "엔트리 제출" 의 의미가 즉시 보이지 않음.

#### CUJ-7: 관전자가 픽/밴 진행을 라이브로 시청 (C)
```
대시보드 → "진행중인 내전" 카드 → PickBan 화면 → 운영자 입력을 실시간 반영
```
**Pain points**: 권한 없음 알림이 우세, 정보 가치는 부차적.

---

## 3. 정보 구조 (IA) 재설계

### 3.1 현재 IA 의 문제

- App.tsx 가 4 단계 stage 를 단방향으로 강제 → 화면 간 자유 이동 불가
- navbar 가 컨텍스트 + 권한 + 유저를 모두 떠안음
- 대시보드 = 모집 + 진행중 + 종료 3 섹션이 평면적으로 나열, 운영자 관점에서는 "지금 처리할 것 / 진행중 / 과거" 라는 시간축이 보이지 않음

### 3.2 새 IA

```
┌─ Shell ────────────────────────────────────────────┐
│  Navbar:  [Brand] [Breadcrumb] [···] [System] [Me] │
│  ─────────────────────────────────────────────────  │
│  Steps (현재 stage 시각화, 클릭으로 이동 가능)      │
│  ─────────────────────────────────────────────────  │
│                                                      │
│  Main:                                               │
│   - Dashboard (LIST)                                 │
│   - EntryEditing (ENTRY_EDITING)                     │
│   - PickBan (IN_GAME)                                │
│   - SeriesResult (COMPLETED)                         │
│                                                      │
│  ─────────────────────────────────────────────────  │
│  Footer (mobile):  Sticky primary CTA               │
└──────────────────────────────────────────────────────┘
```

**System 영역**: navbar 우측에 **하나의 작은 dock** — WS 연결, 저장 상태, 다른 운영자 presence 를 통합. 현재처럼 알림이 분산되지 않게.

**Steps 클릭 가능**: 완료된 단계로 되돌아갈 수 있음. 단 IN_GAME 에서 ENTRY_EDITING 으로 가려면 "엔트리 수정 대기로" 액션이 필요(현재 동작 유지) → Steps 클릭 시 안내.

**대시보드 IA**:
- 상단: "처리 대기" (= 현재 운영자가 액션해야 할 항목) — 모집 마감 / 진행 중 모두 여기로
- 하단: "지난 내전" (열람용)
- 시간순보다 "상태별" 그루핑이 운영자 관점에 맞음

---

## 4. 인터랙션 패턴 (Cross-cutting)

여기서부터가 v1 대비 핵심 보강.

### 4.1 다중 운영자 / 협업 / Presence

**원칙**: 다른 운영자의 존재와 행동은 항상 보이되, 방해되지 않아야 한다.

**구현**:
- **Presence dock** (navbar 우측):
  - 같은 화면을 보고 있는 운영자의 아바타 그룹 (`avatar avatar-group -space-x-3`)
  - hover 시 이름 + 마지막 활동 시각
  - 자기 자신은 항상 첫 번째, 테두리 강조
- **변경 알림 (toast)**:
  - 다른 운영자가 변경 시: `toast toast-bottom toast-end` + `alert alert-info alert-soft` (1.5s 자동 닫힘)
  - 메시지 형식: "{이름}: TEAM_1 TOP 에 Bob 배치"
  - 연속 변경은 묶어서 표시 ("3 회 변경")
- **변경 위치 시각화**:
  - 다른 운영자가 방금 수정한 슬롯/픽 셀에 `ring-2 ring-info ring-offset-1` 1.2 초간 펄스
  - 해제는 자동, 사용자가 hover 하면 즉시 해제
- **충돌 시각화**:
  - 내가 직전에 수정한 위치에 다른 운영자의 변경이 덮여쓰기 됐을 때:
    `alert alert-warning alert-soft` "방금 작성한 X 슬롯이 {이름} 의 변경으로 덮여쓰기되었습니다 · [되돌리기]"
  - 되돌리기는 5 초 안에만 노출
- **내 활동 표시**:
  - 자동저장 후 `text-success text-xs` "저장됨 · 방금" → 점차 흐려짐 (5 초 후 사라짐)

**구현 비용**: 서버측 presence 토픽 추가 필요 (별도 작업). UI 만 우선 구현 가능 (mock presence).

### 4.2 시스템 피드백 / 상태

**원칙**: 사용자가 "지금 무슨 일이 일어나고 있는지" 묻기 전에 답이 보여야 한다.

**4 가지 상태 채널**:

| 채널 | 위치 | 형식 | 예시 |
|---|---|---|---|
| 연결 (WS) | navbar dock | dot + 색 | 🟢 실시간 / 🟡 재연결 중 / 🔴 끊김 |
| 저장 (draft) | 화면 헤더 옆 | 페이드아웃 텍스트 | "저장됨 · 방금" |
| 동기화 (다른 사용자) | 변경 위치 | 펄스 링 | (위 4.1) |
| 작업 결과 (mutation) | toast | `alert alert-soft` | "Game 2 결과 저장됨" |

**WS 연결 상태별 UX**:
- 🟢 정상: dot 만, 텍스트 없음
- 🟡 재연결 중 (1~5 초): "재연결 중…" + spinner. 액션은 막지 않음 (낙관적).
- 🔴 끊김 (5 초 이상): `alert alert-warning` 화면 상단 sticky, 모든 mutation 버튼 disable + tooltip "오프라인입니다 — 연결 복구 시 자동 재시도"

**저장 상태**:
- 입력 발생 → 즉시 "저장 중…" (`text-base-content/60`, dot 펄스)
- 400 ms 디바운스 후 PUT → 성공 → "저장됨 · 방금" (`text-success`)
- 5 초 후 점차 흐려짐
- 실패 → `text-warning` "저장 실패 · 재시도" (클릭으로 재시도)

### 4.3 에러 복구

**원칙**: 모든 에러 화면에는 "다시 시도" 와 "다른 곳으로" 두 가지 회복 경로가 있어야 한다.

| 에러 | 현재 | v2 |
|---|---|---|
| 초기 인증 실패 | `<pre>` 에러 메시지 | `card` 형식, 단축 메시지 + "전체 로그 보기" collapse + "재시도" CTA |
| 데이터 fetch 실패 | `alert alert-error` + 메시지 | + "↻ 새로고침" + "← 대시보드로" 두 버튼 |
| Mutation 실패 | inline `alert` | inline 유지하되 "재시도" / "취소" 두 버튼 + 원 입력값 보존 |
| WS 끊김 | 무표시 (현재 문제) | navbar dock 에 명시 + 자동 재연결 |
| 권한 없음 | `alert alert-warning` 한 줄 | 인라인 (방해 적게) + 모든 disabled 버튼에 사유 tooltip |

### 4.4 모바일 / 터치 입력

**원칙**: 마우스/트랙패드 없이도 모든 작업이 가능해야 한다.

**4.4.1 EntryEditing 의 DnD 대체 — Tap-to-Place**

현재: HTML5 DnD 만 지원. 모바일에서 거의 동작하지 않음.

v2:
- **DnD 와 Tap-to-Place 동시 지원** (한쪽 사용 시 다른 쪽 비활성 X)
- Tap-to-Place 흐름:
  1. 후보 카드 탭 → `ring-2 ring-primary` + "어디에 배치할까요?" toast
  2. 빈 슬롯 (또는 다른 사람 슬롯) 탭 → 즉시 배치
  3. 다른 후보 탭 또는 Esc → 선택 해제
- 빈 슬롯은 미선택 시에도 `border-2 border-dashed`, 후보 선택 후엔 `border-primary border-2 bg-primary/5` 로 하이라이트되어 "여기에 놓을 수 있어요" 명시
- 슬롯에 이미 사람이 있으면 → swap 또는 replace 둘 다 시각화
  - 슬롯 탭 시 "Bob → Charlie 로 교체할까요?" inline confirmation
- 같은 후보를 다시 탭 = 선택 취소

**4.4.2 PickBan 의 Tap-to-Place** (이미 구현됨)

현재 슬롯 클릭 → activeSlot → 챔프 클릭 → 배치. 이미 잘 동작.
추가 개선:
- activeSlot 표시를 더 강하게: 슬롯 자체에 `ring-2 ring-primary` + 슬라이드 아이콘
- 활성 슬롯이 있을 때 챔프 그리드 위에 sticky 안내 바: "🎯 1팀 픽 #2 · 챔프 선택"
- Esc 로 activeSlot 해제

**4.4.3 터치 hit target**

- 모든 인터랙티브 요소 ≥ 40 × 40 px
- 챔프 그리드 셀: 현재 60 px → 모바일에서는 56 px, 단 부모 grid 폭에 맞춰 자동 (`auto-fill`)
- 슬롯 ✕ 버튼: 현재 `btn-xs` → 터치 hit area `before:absolute before:inset-[-8px]` 로 확장

**4.4.4 모바일 specific**

- navbar collapsible — `< 640px` 에서 brand + 햄버거. 햄버거 탭 시 `drawer` 로 컨텍스트/유저/시스템.
- Steps 가 `steps-vertical` 로 전환되되 5 단계 → 3 단계 축약 (현재 단계 + 직전/다음만)

### 4.5 키보드 & 접근성

| 키 | 컨텍스트 | 동작 |
|---|---|---|
| Tab | 모든 화면 | 자연스러운 focus 순서 |
| Enter | 슬롯/카드 | DnD 와 동일한 Tap-to-Place |
| Esc | activeSlot / 모달 / 토스트 | 닫기 / 해제 |
| ↑ ↓ ← → | 챔프 그리드 | 셀 이동 |
| / | 어디서나 | 챔프 검색 input focus |
| 1 / 2 / 3 | PickBan 상단 | 게임 탭 전환 |
| ? | 어디서나 | 단축키 안내 modal |

**스크린리더**:
- WS 동기화 변경: `aria-live="polite"` region 으로 announce
- 에러: `role="alert"` (현재 daisyUI alert 기본 동작)
- DnD/Tap-to-Place 진행 단계: aria-live 로 안내 ("Bob 선택됨 · 슬롯 선택을 기다립니다")

**색맹 안전성 (3중 인코딩)**:
- 1팀/2팀: 색(`info`/`error`) + 라벨("1팀"/"2팀") + 좌측 4px border
- BLUE/RED 사이드: 색 + 라벨 + 카드 헤더 텍스트
- 밴 표시: 빨간색 + 대각선 사선 (CSS) + "BAN" 텍스트
- 픽 표시: 색상 없는 윤곽 + 챔프 이미지
- 진행 상태: 색 + 아이콘(✓/●/⬚)

### 4.6 위험 액션 (2-click confirm 패턴 강화)

Discord sandbox 가 native confirm 차단 → 2-click 패턴 유지 필요. 현재는 텍스트만 변하는데, 시각적으로 부족.

**v2 패턴 — 카운트다운 confirm**:
1. 첫 클릭 → 버튼 색 빨강 변경 + 텍스트 "다시 클릭 = 확정" + **3 초 progress 카운트다운 바**
2. 3 초 안에 다시 클릭 → 실행
3. 3 초 경과 → 자동 취소, 버튼 원상복구

**구현**:
```jsx
<button className={`btn btn-sm ${pending ? "btn-error" : "btn-warning"}`}>
  {pending ? "다시 클릭 = 확정" : label}
  {pending && <progress className="progress progress-error w-full absolute bottom-0 h-0.5" />}
</button>
```

**적용 액션**:
- "엔트리 수정 대기로" (시리즈 삭제)
- "직전 게임 되돌리기" (게임 + MMR 변동 삭제)
- 향후: "결과 입력 후 수정" 등

**적용 안 함 (undo 가능한 액션)**:
- 챔프 픽/밴 (다시 클릭 = 해제)
- 슬롯 배치 (다시 드래그 = 변경)

### 4.7 온보딩 / 빈 상태 / 도움말

**원칙**: 빈 상태는 "정보가 없음" 이 아니라 "다음에 무엇을 할 수 있는지" 알려주는 캔버스.

**빈 상태 디자인 패턴**:
```
┌────────────────────────────────────┐
│           [작은 일러스트]           │
│                                     │
│   엔트리 수정 대기 중인 모집 없음   │
│                                     │
│   ① 봇 채널에서 [/내전모집] 입력    │
│   ② 정원 도달 시 [▶ 시작] 버튼     │
│                                     │
│   [도움말 보기]   [봇 채널 가기*]   │
└────────────────────────────────────┘
* discord:// 딥링크 가능 시 (Activity SDK 확인 필요)
```

**도움말 시스템**:
- 화면별 우상단 `?` 버튼 → `drawer drawer-end` 슬라이드 인 → 화면 사용법 단계별 + 단축키
- 첫 진입 시 자동 노출 (localStorage flag)
- 사용자가 닫으면 다시 묻지 않음

**튜토리얼 모드 (옵션)**:
- 운영자 권한 첫 사용 시 navbar 옆에 작은 "투어 시작 ▷" 부유 버튼
- 클릭 시 daisyUI `tooltip` 으로 단계별 가이드 (DnD 강조 → 제출 버튼 강조 → 마침)

---

## 5. 시각 시스템

(v1 의 토큰/시맨틱 부분을 보강)

### 5.1 컬러 토큰 매핑 (단일 진실)

| 의미 | daisyUI 토큰 | 사용처 |
|---|---|---|
| 1팀 | `info` | 배지 / 텍스트 / 좌측 4px border / 스코어 |
| 2팀 | `error` | 동일 (사이드와 충돌 시 사이드 우선) |
| BLUE 사이드 | `info` | 카드 헤더 / 사이드 버튼 |
| RED 사이드 | `error` | 동일 |
| 대기/진행 중 | `warning` | 배지 (모집 대기, 진행 중) |
| 완료/성공 | `success` | 배지 (시리즈 종료, 우승) |
| 위험 (확정) | `error` filled | 2-click 확정 단계 버튼 |
| 진행도 | `primary` | progress, 활성 step |
| 강조/포커스 | `primary` | ring, hover border |
| 비활성 | `base-content/40` + grayscale | 챔프 사용됨/fearless |

**1팀 RED 사이드** 같은 충돌 케이스: **사이드 색 우선** + 1팀 라벨은 텍스트로 옆에 배치. 카드 헤더는 RED, 헤더 옆 작은 `badge badge-info badge-xs` "1팀".

### 5.2 간격/밀도 시스템

`card-compact` 와 `card-normal` 두 단계만 사용.

| 화면 | 카드 밀도 | gap | padding |
|---|---|---|---|
| 대시보드 | normal | gap-3 | p-4 |
| 엔트리 슬롯 보드 | compact | gap-2 | p-3 |
| 후보 풀 | compact | gap-1.5 | p-2 |
| 픽밴 보드 | compact | gap-2 | p-3 |
| 챔프 그리드 | tight (special) | gap-1 | p-1 |

### 5.3 라운드/그림자

- `--radius-box: 0.75rem` (카드)
- `--radius-field: 0.5rem` (입력/배지)
- 그림자는 `shadow-sm` 만 사용. `shadow-md` 이상은 모달/토스트에만.

### 5.4 라인 / 챔프 / 팀 아이콘

- 라인 5 종은 inline SVG 18×18 — 현재 텍스트 라벨만 있는 자리에 추가
- 팀: 아이콘 없음, 색 + 라벨로 충분
- 트로피(우승): SVG 14×14, `text-success` (Unicode 이모지 X — OS 간 표시 차이)
- ✓ / ● / ⬚ 진행 마크: ASCII 아닌 SVG 셋

**아이콘 자산**: 모두 inline SVG 로 6 ~ 10 종 정도. 라이브러리 도입 X.

### 5.5 타이포그래피

- 기본 12 / 14 / 16 / 18 / 24 / 32 (rem 환산)
- Heading: `font-bold tracking-tight`
- 숫자(스코어/통계): 항상 `tabular-nums` (이미 일부 적용 중)
- 마이크로카피: `text-xs text-base-content/70` (일관)

---

## 6. 화면별 재설계

v1 의 화면별 권고를 UX 관점으로 재배치.

### 6.1 글로벌 셸 (App + Navbar + Steps)

**Navbar 좌측**: Brand → breadcrumb (`breadcrumbs text-sm`)
- `대시보드 / 모집 #12` (LIST → ENTRY_EDITING)
- `대시보드 / 시리즈 #34` (LIST → IN_GAME)
- breadcrumb 의 각 segment 는 클릭으로 이동 가능 (Steps 와 중복 OK — 두 곳 다 작동)

**Navbar 우측 (System Dock)**:
```
[🟢 실시간] [💾 저장됨] [👥 운영자 2] [✏ 운영자 / 👤 username]
```
- 연결 dot: 색만, hover 시 텍스트 노출
- 저장: 활동 있을 때만 나타남
- presence: 1 명 초과 시만 노출
- 권한 + 유저: 단일 dropdown 으로 묶음

**Steps**:
- `steps-vertical lg:steps-horizontal`
- 완료 = `step-success` + ✓
- 현재 = `step-primary` + ●
- 미래 = 회색 + 숫자
- 클릭 가능 — 단 IN_GAME → ENTRY_EDITING 은 액션 필요(현재 동작) → 클릭 시 `tooltip` 으로 안내
- 모바일에서는 현재 단계 + 직전/다음만 표시 (3 단계)

### 6.2 대시보드 (RecruitmentList)

**상단 — Stats 요약 (NEW)**:
```
┌──────┬──────┬──────┐
│  대기 │ 진행 │  종료 │
│  3   │  1   │  47  │
│  ↻   │      │      │
└──────┴──────┴──────┘
```
- `stats stats-horizontal shadow-none border border-base-300`
- 클릭 시 해당 섹션으로 anchor 스크롤
- 새로고침 버튼은 stats 우측에 `btn btn-circle btn-ghost btn-sm`

**섹션 1: 처리 대기 (NEW 그룹)**:
- 모집 마감 + 진행 중 시리즈를 **하나의 섹션** 으로 묶음 (운영자 관점에서는 모두 "지금 처리할 것")
- 카드 좌측 4px 액센트로 종류 구분: 모집(`border-warning`) / 진행(`border-info`)
- 정렬: 가장 오래된 것 위로 (방치 방지)

**섹션 2: 지난 내전**:
- 그대로 유지하되 `collapse collapse-arrow` 안에 (기본 펼침)
- 검색/필터 input 한 줄: 시리즈 ID, 참가자 이름, 시즌
- 무한 스크롤 또는 "더 보기" (현재 limit=20 만)

**카드 디자인**:

*RecruitmentCard*:
```
┌─────────────────────────────────────┐
│ ⚠ 5v5 내전          [엔트리 대기]  │
│ 모집 #12 · 12분 전                  │
│ ━━━━━━━━━━━━━━━━━━━━━━ 10/10        │
│ 👥 영주, 호빵, 알파, 베타, 감마      │
└─────────────────────────────────────┘
        ↑ hover 시 [→ 엔트리 수정] CTA 부유
```

*SeriesCard (진행)*:
```
┌─────────────────────────────────────┐
│ 🔵 시리즈 #34          ● 라이브     │
│ Game 2/3 · 12분 전 시작              │
│ [라인업 미니뷰: 2팀 5라인 한 줄]     │
└─────────────────────────────────────┘
```
- 라이브 dot: `bg-success animate-pulse size-2 rounded-full`
- presence 가 있다면 우상단에 mini avatar group

*CompletedSeriesCard*:
```
┌─────────────────────────────────────┐
│ 시리즈 #28        🏆 1팀 우승       │
│  3   :   1                          │
│  1팀     2팀                         │
│ ▼ 라인업 보기                        │
└─────────────────────────────────────┘
```
- 스코어가 focal — `text-3xl tabular-nums`
- 라인업은 collapse, 기본 접힘

**빈 상태**:
- 위 4.7 의 패턴 적용 — 다음 액션 명시 + 도움말 링크

**스켈레톤**:
- 실제 카드와 같은 비율 (heading + 2 줄 + 라인업 placeholder)
- `animate-pulse` (skeleton 기본)

### 6.3 엔트리 수정 (EntryEditing)

**헤더**:
```
대시보드 / 모집 #12
엔트리 수정                            [↻] [💾 저장됨] [✏ 엔트리 제출 8/10]
5v5 · 후보 10 명 · 배정 8/10
[━━━━━━━━━━━━━━━━━━━━─────] 80%
```
- breadcrumb (위)
- 타이틀 + 우측 작업바
- 진행도 progress bar 추가 — 80% 표시
- 제출 버튼: disabled 시 "8/10" 표시, 활성 시 "엔트리 제출"
- 자동저장 표시 (4.2)

**슬롯 보드**:
- 카드 상단 4px 액센트 (`border-t-4 border-info|error`) — v1 유지
- 팀 헤더에 라벨 + 평균 winrate 미니 통계
  - "1팀 · 평균 WR 52%" (history 평균)
- 슬롯 행:
  - 좌: 라인 SVG + 라벨 (TOP/JG/MID/BOT/SUP)
  - 중: 배정 카드 또는 빈 슬롯
  - 우: ✕ (배정 시만)
  - 빈 슬롯 = `border-2 border-dashed border-base-300` + "여기에 드롭/탭하여 배치"
  - 활성 후보가 있을 때(Tap-to-Place) = `border-primary bg-primary/5 ring-1 ring-primary`
  - drag-over = 동일 + scale 1.02 transition

**후보 풀**:
- 헤더에 정렬 토글 — `tabs tabs-xs tabs-boxed`:
  - 추천 (자동 정렬 — 미배정인 사람 + history.topRole 기반 추천 라인 하이라이트) [기본]
  - 이름순
  - WR
- "추천" 모드 시 — 활성 슬롯이 있으면 그 라인을 main 으로 가진 사람을 상단으로 끌어올림
- 카드 그리드 1 / 2 / 3 열 (반응형)

**ParticipantCard**:
```
┌───────────────────────────────────┐
│ [Avatar] 영주     52%  120-110    │
│         [TOP][JG] | 주 TOP        │
│                  [c1][c2][c3] +2  │
└───────────────────────────────────┘
```
- 좌측 32px placeholder avatar + 이니셜
- WR 색: ≥ 50% `text-success`, ≥ 55% `text-success font-bold`, < 50% `text-warning`, < 45% `text-error`
- 챔프 아이콘: 3 개 + "+2" → hover 로 4-5 번째 노출
- 신규 = `border-l-2 border-primary` + `badge badge-primary badge-xs` "신규"

**자동 배치 제안 (NEW)**:
- 진입 시 빈 슬롯 모두 → `history.topRole` 기반 자동 매칭 시도
- 매칭 후 사용자에게 `alert alert-info alert-soft` "추천 자동 배치를 적용했습니다. [모두 해제] [그대로 사용]"
- 클릭으로 거부 가능, 거부 상태 localStorage 기억

**제출 흐름**:
- 제출 클릭 → 버튼 → loading + "엔트리 검증 중…" → "시리즈 생성 중…" → 자동 이동
- 실패 시 inline `alert` + 입력값 보존 (현재 OK)

### 6.4 픽/밴 (PickBan) — 가장 큰 변화

**6.4.1 화면 레이아웃 (재구성)**

```
┌─ Header bar ───────────────────────────────────────┐
│ 시리즈 #34 [Bo3 1-0]      [↻] [⋯] [엔트리로]      │
│ 5v5 · Game 2/3                                     │
└────────────────────────────────────────────────────┘

┌─ Score + 현재 게임 정보 ────────────────────────────┐
│  1팀  ┃  1     2팀  ┃  0      Game 2 진행 중       │
│  Bo3  ┃ ─────────                                   │
│       ┃ 1팀: BLUE / 2팀: RED                        │
└────────────────────────────────────────────────────┘

┌─ 게임 탭 ──────────────────────────────────────────┐
│ [Game 1 ✓ 1-0] [Game 2 ●] [Game 3 -]              │
└────────────────────────────────────────────────────┘

┌─ 사이드 선택 (1팀이 BLUE? RED?) ──────────────────┐
│  [1팀 BLUE  ✓]   [1팀 RED]                         │
└────────────────────────────────────────────────────┘

┌─ 픽밴 보드 ────────────────────────────────────────┐
│ ┌─ 1팀 (BLUE) ────┐ ┌─ 2팀 (RED) ─────┐           │
│ │ 밴: ▢▢▢▢▢       │ │ 밴: ▢▢▢▢▢       │           │
│ │                 │ │                  │           │
│ │ TOP   [▢] Bob   │ │ TOP   [▢] Eve    │           │
│ │ JG    [▢] Cha   │ │ JG    [▢] Fox    │           │
│ │ ...             │ │ ...              │           │
│ └─────────────────┘ └──────────────────┘           │
└────────────────────────────────────────────────────┘

┌─ Sticky 안내 바 (활성 슬롯 있을 때) ───────────────┐
│ 🎯 1팀 픽 #2 (JG) · 챔프 선택 ─ Esc 로 취소        │
└────────────────────────────────────────────────────┘

┌─ 챔프 그리드 ──────────────────────────────────────┐
│ [검색…  ✕] [전체|TOP|JG|MID|BOT|SUP] [플레이어 main]│
│ 🛡 Hard Fearless 12 챔프 비활성                    │
│ [그리드 6~8 열, 60~80px 셀]                        │
└────────────────────────────────────────────────────┘

┌─ 결과 입력 (모든 슬롯 채워졌을 때) ────────────────┐
│ Game 2 결과                                         │
│ ◯ 1팀 승      ● 2팀 승                             │
│ 게임 시간 (선택): [22:14]                          │
│ [Game 2 결과 저장]                                  │
└────────────────────────────────────────────────────┘
```

**6.4.2 변경 핵심**

1. **시리즈 스코어 + 사이드 정보 통합** — 두 카드 → 한 카드. 라인업 미리보기는 별도(접힘) 영역으로 이동.
2. **게임 탭 강화** — 각 탭에 스코어 미리보기. 완료된 탭 클릭 시 read-only 모드로 다시 보기.
3. **사이드 선택 단순화** — 4 버튼 → 2 버튼 (1팀이 BLUE 인지 RED 인지만 결정).
4. **픽밴 보드 1팀/2팀 분리 유지**, 단:
   - 카드 헤더 색은 사이드 색 (1팀 RED 면 `text-error` + 헤더 옆 `badge` "1팀")
   - 밴 슬롯은 좌상단, 작은 가로 5 줄 (`grid-cols-5 gap-1`)
   - 픽 슬롯은 라인별 카드 행
5. **Sticky 안내 바 (NEW)** — 활성 슬롯이 있을 때 화면에 sticky `alert alert-primary alert-soft` 로 "지금 무엇을 선택하는 중" 명시. 모바일에서 챔프 그리드까지 스크롤할 때 컨텍스트 유지.
6. **챔프 그리드 강화** — 검색 input 고정 위치, 라인 필터 칩, "플레이어 main" 빠른 필터 (활성 슬롯의 픽 라인일 때 그 플레이어의 history.topChampions 만 보기).
7. **결과 입력 분리** — 사이드/픽밴/결과 3 단계가 명확. 모든 픽 채워지지 않으면 결과 입력 hidden.

**6.4.3 챔프 그리드 — 더 깊게**

핵심 UX 문제: ~170 챔프 중 빠르게 정확히 선택.

전략 = **"필요한 것은 항상 위에"**:
1. **활성 슬롯 = 픽 슬롯** 이면 → 해당 플레이어의 `history.topChampions` 5 개를 그리드 최상단 "주력 챔프" 섹션으로 분리 표시 (`badge badge-primary badge-xs` "MAIN")
2. **이번 시리즈 미사용 + 검색 매칭** 챔프가 다음 섹션
3. 사용된/fearless 챔프는 마지막 섹션, 회색 + grayscale + 비활성 + tooltip 사유

**필터 칩 (NEW)**:
- 전체 / TOP / JG / MID / BOT / SUP / **MY MAINS** (활성 슬롯의 플레이어)
- 활성 슬롯이 픽이면 슬롯 라인이 기본 선택
- 칩은 `tabs tabs-xs tabs-boxed`

**검색 input**:
- `/` 단축키로 즉시 focus
- 한/영 동시 매칭 (현재 OK)
- `Esc` 로 검색 클리어 + activeSlot 해제

**셀 디자인**:
- 60~80px 정사각, 챔프 이미지 + 하단 1줄 이름
- 호버 = `ring-2 ring-primary scale-105`
- 클릭 = 즉시 배치 + activeSlot 해제 + sticky 바 사라짐
- 우상단 mini badge: `F` (fearless), `B` (이번 게임 밴됨), `1` (Game 1 픽됨) 등 — 한 글자

**활성 슬롯 시각화**:
- 슬롯 자체에 `ring-2 ring-primary ring-offset-2 animate-pulse` (1 회만, 이후 정적)
- sticky 바에 슬롯 정보 + 라인/플레이어
- "다른 슬롯으로 변경" — 슬롯 그냥 다시 클릭하면 됨

**6.4.4 위험 액션 dropdown**

상단 우측 `[⋯]` 아래로 묶음:
- 🔄 직전 게임 되돌리기
- ↩ 엔트리 수정 대기로
- ?  단축키 안내
- 📋 라인업 다시 보기

각 항목은 4.6 의 카운트다운 confirm.

**6.4.5 결과 입력 패널 (NEW 디자인)**

현재는 모든 슬롯이 차면 화면 하단에 그냥 노출 — 시각적으로 평평.

v2:
- `card bg-base-200 border-l-4 border-success`
- 헤더: "Game 2 결과 입력" + Game 진행도(작은 progress)
- 본문 — 큰 라디오 카드 두 개:
  ```
  ┌──────────────┐  ┌──────────────┐
  │   1팀 승     │  │   2팀 승     │
  │  ● 선택됨    │  │              │
  │  ○○○○○      │  │  ○○○○○      │
  └──────────────┘  └──────────────┘
  ```
  선택된 쪽은 `bg-info/10 border-info border-2`
- 게임 시간 (선택): mm:ss 마스크 input
- 제출은 화면 하단 sticky `btn btn-primary btn-block` (모바일에서 fallback)

### 6.5 시리즈 결과 (SeriesResult)

**상단**:
```
┌─────────────────────────────────────┐
│       시리즈 #28 · 3월 4일 21:14    │
│      🏆       3 : 1                 │
│    1팀 우승   1팀  2팀               │
│    [라인업 보기 ▼]                   │
└─────────────────────────────────────┘
```
- `hero hero-content text-center` 풍의 mini hero
- 라인업은 collapse, 기본 접힘

**게임별**:
- `collapse collapse-arrow bg-base-200` 3 개 — 기본은 모두 펼침 (열람 효율)
- 각 collapse 헤더: `Game N · BLUE/RED 사이드 · 시간 · 우승 팀`
- 본문:
  ```
  ┌─ 1팀 (BLUE) WIN 🏆 ────┐ ┌─ 2팀 (RED) ────┐
  │ 밴: [c1][c2][c3][c4][c5] │ │ 밴: [c1]...    │
  │ 픽:                     │ │ 픽:             │
  │ TOP  [chmp] Bob         │ │ TOP  [chmp] Eve │
  │ JG   [chmp] Cha         │ │ JG   [chmp] Fox │
  │ ...                     │ │ ...             │
  └─────────────────────────┘ └─────────────────┘
  ```
- 우승 팀 컬럼은 `border border-success` + 우상단 `badge badge-success` "WIN"

**API 보완 필요**: 현재 series detail 응답에 bans 미포함 (코드 코멘트 참조). API 추가하거나, 게임별 별도 fetch 필요.

**푸터 액션**:
- "← 대시보드"
- "🔗 공유 링크 복사" — Discord 메시지 deep link 또는 series URL (가능 여부 확인)

### 6.6 라인업 미리보기 (LineupPreview)

3 모드:

| 모드 | 사용처 | 형식 |
|---|---|---|
| `mini` | 대시보드 SeriesCard | 한 줄 가로, 라인 SVG + 이니셜 (5+5=10 셀) |
| `compact` | PickBan 상단 / EntryResult collapse | 5 행 × 2 팀 표 (현재) |
| `default` | 전용 화면 (없음, 향후) | 풀 카드 |

라인 라벨 컬럼 = `bg-base-300/40` 미세 배경 + SVG 라인 아이콘.
1팀/2팀 컬럼 사이 vertical divider.

### 6.7 관전(Read-only) 모드 — 재설계

원칙: 권한 없는 사용자에게도 **읽는 가치** 가 있어야 한다.

**현재**: 모든 화면에서 `alert alert-warning` "👁 읽기 전용" + 버튼 disable.

**v2**:
- alert 는 dismissible — 한 번 닫으면 세션 동안 안 보임 (방해 줄임)
- 권한 인디케이터는 navbar 에만 (4.1 dock)
- 모든 disabled 버튼에 동일 사유 tooltip ("운영자 권한이 필요합니다")
- PickBan 화면에서 추가:
  - 라이브 dot + "운영자 {이름} 입력 중" (presence 활용)
  - 슬롯이 채워질 때 살짝 슬라이드 인 애니메이션 (관전 중임을 강조)
  - 화면 하단에 "이 시리즈에 참가 중인가요? 봇 채널에서 다음 시리즈 모집을 확인하세요" 마이크로카피
- EntryEditing 화면에서:
  - 후보 풀 카드를 readonly tooltip 으로 디테일 노출 (전적/주 챔프 등) — 운영자 모드보다 더 풍부하게 보여줄 수도 있음
- SeriesResult: 차이 없음 (이미 read-only)

---

## 7. 컴포넌트 패턴 (재사용 가능한 빌딩블록)

신규 추가/통합할 패턴 목록:

| 컴포넌트 | 용도 | daisyUI 기반 |
|---|---|---|
| `<SystemDock />` | navbar 우측 (연결/저장/presence/유저) | navbar + dropdown + avatar-group + tooltip |
| `<Breadcrumb />` | navbar 컨텍스트 | breadcrumbs |
| `<TeamLabel team side />` | 1팀 RED 같은 충돌 표시 | 색 + badge + 텍스트 |
| `<LaneIcon role />` | 라인 SVG | inline svg |
| `<EmptyState title body steps cta />` | 모든 빈 상태 | card + svg + kbd |
| `<ConfirmButton label onConfirm />` | 2-click 카운트다운 confirm | btn + progress |
| `<SaveStatus state when />` | 자동저장 인디케이터 | text + dot |
| `<PresenceGroup users />` | 운영자 아바타 묶음 | avatar-group |
| `<Toast type message timeout />` | 변경/액션 결과 토스트 | toast + alert |
| `<Stepper current onChange />` | 클릭 가능 steps | steps |
| `<SortTabs options value onChange />` | 정렬 칩 | tabs-boxed-xs |
| `<RadioCard checked label desc />` | 큰 결과 선택 카드 | card + radio (시각 변경) |
| `<HelpDrawer screen />` | `?` 화면별 도움말 | drawer-end |

각 컴포넌트는 `apps/activity/src/components/` 에 추가, 화면별 코드에서 인라인되어 있는 패턴을 추출.

---

## 8. 우선순위 로드맵

**원칙**: 사용자 가치 / 구현 비용으로 우선순위.
v1 의 "P1 토큰부터" 가 아니라 **"가장 많은 사용자가 가장 자주 겪는 고통"** 부터.

### Wave 1 — 즉각 체감 (1~2 PR, low risk)
1. **시각 토큰 정리** (1팀=info / 2팀=error 통일) — 5.1 의 컬러 매핑
2. **2-click 카운트다운 confirm** — 4.6 (위험 액션의 신뢰성)
3. **빈 상태 → 다음 액션 가르치기** — 4.7 + 6.2
4. **disabled 버튼에 사유 tooltip 일괄** — 4.5 색맹 + 4.3 권한
5. **WS 연결 상태 표시** — 4.2 (기본 dot 만 우선)

### Wave 2 — 협업 / 회복 (3~4 PR, medium)
6. **System Dock + 자동저장 표시** — 4.2 + 6.1
7. **Tap-to-Place 입력 (EntryEditing)** — 4.4.1 (모바일 사용자 즉시 회복)
8. **변경 toast + 위치 펄스** — 4.1 (presence 토픽 없이도 WS reload 만으로 동작 가능)
9. **Sticky 안내 바 (PickBan)** — 6.4.2 #5 (활성 슬롯 컨텍스트)

### Wave 3 — 픽/밴 대수술 (1 large PR, high)
10. **PickBan 화면 레이아웃 재구성** — 6.4.1
11. **챔프 그리드 강화 (필터/MY MAINS/섹션 분리)** — 6.4.3
12. **결과 입력 RadioCard** — 6.4.5
13. **위험 액션 dropdown** — 6.4.4

### Wave 4 — 대시보드 / 결과 / 관전 (medium)
14. **대시보드 IA 재편 (Stats + 처리대기 그룹)** — 6.2
15. **자동 배치 제안 (EntryEditing)** — 6.3
16. **SeriesResult collapse + bans 노출** — 6.5 (백엔드 API 보완 동반)
17. **관전 모드 재설계** — 6.7

### Wave 5 — 마무리 (low)
18. **온보딩 / 도움말 drawer** — 4.7
19. **키보드 단축키 풀 셋** — 4.5
20. **튜토리얼 모드 (옵션)** — 4.7

각 wave 는 독립 mergeable. Wave 1 만 끝내도 사용자 체감 변화는 큼. Wave 3 가 가장 위험 — 별도 브랜치에서 충분한 검증 권장.

---

## 9. UX 검증 체크리스트

### 9.1 Nielsen 휴리스틱 자가점검 (각 화면별)

- [ ] **Visibility of system status**: WS / 저장 / presence / 진행 상태가 항상 보임
- [ ] **Match real world**: 1팀/2팀, 픽/밴, 시리즈/게임, BLUE/RED — LoL 도메인 어휘 일관
- [ ] **User control & freedom**: 모든 액션은 undo 또는 cancel 가능
- [ ] **Consistency & standards**: 같은 액션은 같은 모양 (제출 = primary, 위험 = error+countdown)
- [ ] **Error prevention**: 잘못된 클릭 자체를 차단 (fearless 챔프 disable, 미완성 제출 disable)
- [ ] **Recognition over recall**: 챔프/라인/팀은 모두 시각 인식 가능
- [ ] **Flexibility & efficiency**: 단축키 + 자동 배치 제안 + MY MAINS 필터로 파워 유저 가속
- [ ] **Aesthetic & minimalist**: 한 화면에 primary action 하나
- [ ] **Help diagnose / recover**: 모든 에러에 회복 경로 2 개
- [ ] **Help & documentation**: `?` drawer + 빈 상태 onboarding

### 9.2 시나리오 기반 통과 기준

| 시나리오 | 통과 기준 |
|---|---|
| CUJ-1 (모집 → 시작) | 클릭 ≤ 5, 시간 ≤ 30s, 수동 정렬 없이 추천 배치 활용 가능 |
| CUJ-2 (Game 1 픽/밴) | 클릭 ≤ 25, 시간 ≤ 90s, 챔프 검색 → 클릭 ≤ 2 |
| CUJ-3 (동시 편집) | 다른 운영자 변경이 1.5 초 내 화면 반영, 변경자 명시, 충돌 시 회복 가능 |
| CUJ-4 (재실행 후) | 진입 후 5 초 내 "어디까지 했는지" 시각 인식 |
| CUJ-5 (모바일 터치) | DnD 없이 풀 워크플로우 완결 (엔트리 → 픽밴 → 결과) |
| CUJ-6 (신규 운영자) | 도움말 안 보고도 첫 시리즈 완료 가능 |
| CUJ-7 (관전) | 라이브 진행이 자연스럽게 보임, "권한 없음" 이 1 차 인상이 아님 |

### 9.3 디바이스/환경 매트릭스

| 환경 | 폭 | 검증 |
|---|---|---|
| Discord 데스크 | 800~960px | 기본 — 2 열 픽밴 보드 |
| Discord 모바일 | 375~430px | 1 열 + Tap-to-Place 동작 |
| 풀와이드 | 1280px+ | 픽밴 + 챔프 그리드 양쪽 동시 |
| 다크 (기본) | - | 모든 컬러 토큰 |
| 라이트 | - | 토큰 정합성만 (1차 타겟 X) |

---

## 10. 비목표 (Non-Goals)

- **외부 UI 라이브러리 도입** (radix / headless / shadcn 등) — daisyUI + Tailwind 만으로 처리.
- **아이콘 라이브러리** — 인라인 SVG 6~10 종으로 충분.
- **애니메이션 라이브러리** (framer-motion / motion-one) — Tailwind animate utility + CSS transition 만.
- **국제화 / 다국어** — 한국어 단일 (현재 사용자 100%).
- **라이트 테마 1차 지원** — 다크 우선, 라이트는 토큰 정합성만.
- **음향 피드백** — Activity SDK 의 audio 권한 검토 후 재고.
- **공유/스크린샷 export** — out of scope.
- **AI 기반 추천** (밴 추천, 픽 추천 등) — 도메인 가치 vs 구현 비용 비대칭, out of scope.

---

## 11. 부록: 측정 가능 지표 제안

배포 후 추적 가능한 지표 (백엔드 telemetry 협의 필요):

- 시리즈당 평균 입력 시간 (PickBan 진입 → 완료)
- 게임당 픽/밴 입력 시간
- 자동저장 빈도 / 저장 실패율
- WS 끊김 비율 / 평균 재연결 시간
- 권한 없음 진입 비율
- 모바일 사용자 비율 / 모바일 완료율
- 2-click confirm 첫 클릭 → 두번째 클릭 비율 (사용자 의도 유효성)
- 챔프 검색 → 선택 평균 시간

이 지표들이 v2 의 디자인 결정을 후속 가설로 검증한다.
