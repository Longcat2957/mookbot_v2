# 경매내전 — 기획서

> 이벤트성 신규 모드. 기존 [`PLAN.md`](./PLAN.md) 의 일반 내전 흐름과 **완전히 격리**된 별도 라이프사이클.
> 작성: 2026-05-12. 구현 시작 전 결정 필요 항목은 [§12 Open Questions](#12-open-questions) 참조.

---

## 1. 개요

### 1.1 동기

기존 일반 내전(`/내전모집`) 은 라인별 MMR 계산 / 시즌 누적 / 리더보드 반영이 도메인 핵심. 그러나 "이벤트성 경매 드래프트" 라는 다른 형식의 내전 수요가 있음:

- 팀장 4명(20인) 또는 2명(10인) 이 **포인트 경매** 로 팀원을 뽑는 드래프트 방식
- 시즌 통계 / MMR / 리더보드 영향 **없음** — 순수 이벤트
- 그러나 픽/밴 챔프는 기록 남김 (전적 조회용)

기존 내전과 라이프사이클이 다르고 (경매 단계 신설), MMR 영향 격리가 critical 이므로 별도 모드로 추가.

### 1.2 목표

- 10인 / 20인 경매내전 모집부터 종료까지 한 화면 (Activity) 안에서 수행
- 운영자 수동 컨트롤 (포인트 입찰 / 유찰 / 수동 배치) 중심 — 자동 매칭 없음
- 챔프 픽/밴 / 승패 전적은 **일반 사용자 통계와 통합** — 한 번 픽한 챔프는 어떤 흐름에서든 누적
- 종료 후 모집 채널에 결과 카드 발행 (일반 내전 v0.4.3 패턴 재사용)

### 1.3 통합 / 격리 매트릭스

| 데이터 | 일반 내전 | 경매내전 | 동작 |
|---|---|---|---|
| `games` (게임 row) | ✅ INSERT | ✅ INSERT | **통합** — 같은 테이블 |
| `game_stats` (W/L per user) | ✅ INSERT | ✅ INSERT | **통합** — `/내전기록` 라인별 W/L 자동 누적 |
| `game_picks` / `game_bans` | ✅ INSERT | ✅ INSERT | **통합** — 사용자 챔프 누적 자동 |
| `mmr_changes` | ✅ INSERT | ❌ skip | **격리** — `series.type='AUCTION'` 분기 |
| `user_lane_mmr` | ✅ UPDATE | ❌ skip | **격리** — 동일 |
| 리더보드 (라인별 / 종합 MMR) | 영향 | 영향 0 | 자동 (user_lane_mmr 안 건드림) |
| `/랭킹` (시즌 MMR Top 10) | 영향 | 영향 0 | 자동 |

### 1.4 비목표

- **MMR / ELO 계산** — 경매 게임은 `mmr_changes` / `user_lane_mmr` 에 절대 쓰지 않음 (이벤트성)
- **자동 팀 분배 / 추천 매칭** — 운영자 수동만
- **별도 "경매 전적" 페이지** — 통합 통계에 자연 반영, 별도 페이지 불필요

---

## 2. 명령어 인터페이스 (Bot)

기존 일반 내전 슬래시 그룹과 동일 패턴, 별도 명령으로:

| 슬래시 | 운영 | 동작 |
|---|---|---|
| `/경매내전모집` | 누구나 (운영자가 처음 게시) | 채널 모집 메시지 (Components V2). 정원 옵션: **10 / 20** (기본 20) · 제목 옵션. |
| `/경매내전모집인원추가` | 운영자 | 모집에 임의 멤버 강제 추가 (UserSelectMenu) |
| `/경매내전모집인원삭제` | 운영자 | 모집에서 임의 멤버 강제 제거 |
| `/경매내전강제삭제` | 운영자 | 모집 / 경매 시리즈 강제 삭제 (응급) |

> 일반 슬래시 (`/내전모집` 등) 는 **그대로** — 두 흐름이 동시에 운영됨.

채널 메시지는 일반 모집과 비주얼적으로 구분 — 상단 라벨 `🎟️ 경매내전 모집` (일반은 `📣 N v N 내전 모집`).

---

## 3. 모집 단계 (Bot, [1])

| 단계 | 동작 |
|---|---|
| 게시 | 운영자가 `/경매내전모집` 으로 채널 메시지 발행 |
| 참가 | 채널의 **참석 / 참석 취소** 버튼. 라인 선호 입력 **없음** (경매에서 직접 픽됨) |
| 정원 도달 | 10 또는 20 도달 시 운영자에게 `▶ 경매 시작` 버튼 노출 |
| 경매 시작 | 운영자 클릭 → Activity 라우트로 진입 (모집 status → `CLOSED`) |
| 취소 | 운영자 `모집 취소` → status `CANCELLED` |

DB 격리 — 별도 테이블 `auction_recruitments` 사용 (§7).

---

## 4. Activity 라우팅

### 4.1 분리 원칙

기존 `EntryEditing` / `PickBan` 화면과 **완전 분리** — 코드 / 상태 / API 모두 별도 트리.

새 stage 추가 (StageKey):

```
"AUCTION_DRAFT"     // 경매 진행 (팀장 선출 → 입찰 → 배치)
"AUCTION_BRACKET"   // 4강 사다리 + 매치업 결과 입력 (20인만)
"AUCTION_RESULT"    // 종료 화면 (10인의 단일 게임 결과 또는 20인 전체 결과)
```

`AUCTION_*` stage 들은 별도 props (`auctionSeriesId: number`) 를 받음. 일반 흐름의 `recruitmentId` / `seriesId` 와 혼용 X.

### 4.2 화면 컴포넌트 트리 (제안)

```
apps/activity/src/screens/Auction/
├── AuctionDraft.tsx              // 경매 진행 (팀장 선출 → 입찰 → 유찰 → 배치)
│   ├── CaptainPicker.tsx         // 팀장 4명/2명 선출 UI
│   ├── PointAllocator.tsx        // 팀장별 초기 포인트 입력 (기본 1000, 운영자 조정)
│   ├── DiceRoll.tsx              // 비-팀장 N명 중 임의 1명 추출 버튼
│   ├── BidPanel.tsx              // 각 팀장별 입찰 포인트 수동 입력
│   ├── UnsoldList.tsx            // 유찰 리스트
│   └── ManualAssign.tsx          // 포인트 소진 후 수동 배치
├── AuctionBracket.tsx            // 4강 사다리 + 매치업 (20인만)
│   ├── BracketView.tsx           // daisyUI / 직접 SVG — 4강 → 결승
│   └── MatchupPanel.tsx          // 각 매치업 BO1/BO3 결정 + 픽/밴/결과 입력
├── AuctionResult.tsx             // 종료 카드 (모든 게임 픽/밴 + 우승 팀)
├── useAuctionState.ts            // 경매 전체 상태 hook
└── types.ts
```

`PickBan` 의 챔프 그리드 / 검색 컴포넌트 (`ChampCell.tsx` 등) 는 **재사용 가능** — picks/bans 화면이 본질적으로 동일. picks/bans state 만 격리.

---

## 5. 경매 라이프사이클 (20인)

상태기계:

```
RECRUITING   →   CAPTAIN_PICK   →   POINT_ALLOC   →   BIDDING   →   PLACEMENT   →   BRACKET_SETUP   →   IN_GAME   →   COMPLETED
                                                       ↑↓
                                                    UNSOLD (서브 상태)
```

### 5.1 단계별 동작

| 단계 | 위치 | 동작 |
|---|---|---|
| **RECRUITING** | Bot 채널 | 20인 모집 (§3) |
| **CAPTAIN_PICK** | Activity `AuctionDraft` | 운영자가 4명을 팀장으로 지명 (UserSelectMenu 또는 클릭). 누구든 가능, 자기추천 X (참가자 명단 안에서만). |
| **POINT_ALLOC** | Activity `AuctionDraft` | 팀장 4명에게 초기 포인트 입력. 기본 1000 prefill, 운영자가 조정 가능 (실력 격차 핸디캡). |
| **BIDDING** | Activity `AuctionDraft` | 비-팀장 16명 중 한 명씩 처리. 운영자가 🎲 버튼 클릭 → 임의 1명 표시 → 보이스로 경매 → 각 팀장 입찰 포인트 운영자가 수동 기입 → 낙찰 팀에 배치 + 포인트 차감. 입찰 0 이면 UNSOLD 로 이동. |
| **UNSOLD** (서브) | Activity `AuctionDraft` | BIDDING 모두 끝나면 유찰 리스트가 표시됨. 재경매 (BIDDING 으로 돌아감) 또는 운영자 수동 배치. |
| **PLACEMENT** | Activity `AuctionDraft` | 모든 인원 배치 완료. 각 팀 4인 + 팀장 1인 = 5명. 운영자가 [경매 종료 → 토너먼트 시작] 클릭. |
| **BRACKET_SETUP** | Activity `AuctionBracket` | 4강 매치업 자동 생성 (1↔4, 2↔3 또는 팀장 입찰 순). 운영자가 각 매치업의 형식 (BO1 / BO3) 결정. |
| **IN_GAME** | Activity `AuctionBracket` | 각 매치업 진행 — 픽/밴 수동 기입 + 결과 입력. 4강 둘 다 끝나면 결승 매치업 자동 생성. |
| **COMPLETED** | Activity `AuctionResult` + Bot 채널 종료 카드 | 결승 우승 팀 표시. Bot 채널에 전체 결과 카드 발행. |

### 5.2 운영자 액션

| 액션 | 단계 | 효과 |
|---|---|---|
| 팀장 지정 | CAPTAIN_PICK | `auction_teams.captain_user_id` set |
| 포인트 조정 | POINT_ALLOC, BIDDING (긴급) | `auction_teams.initial_points` / `current_points` |
| 🎲 다음 인원 | BIDDING | 비-팀장 + 미배치 중 임의 1명 추출 |
| 입찰 기록 | BIDDING | `auction_bids` row INSERT (target / captain / points) |
| 낙찰 확정 | BIDDING | 최고 입찰 팀에 배치, captain 포인트 차감 |
| 유찰 처리 | BIDDING | 입찰 0 → UNSOLD 리스트 |
| 재경매 | UNSOLD | 유찰자 다시 BIDDING |
| 수동 배치 | UNSOLD, PLACEMENT | 포인트 무관 강제 팀 배치 |
| BO1/BO3 결정 | BRACKET_SETUP | `auction_matches.format` |
| 픽/밴/결과 기입 | IN_GAME | `auction_games` + `auction_game_picks/bans` |
| 매치 되돌리기 | IN_GAME | 직전 매치 결과 DELETE |
| 경매 강제 종료 | (모든 단계) | status = CANCELLED |

---

## 6. 10인 경매 (변형)

20인 흐름의 축약. 명시되지 않은 부분은 **합리적 유추** (구현 전 확정 필요).

| 단계 | 차이점 |
|---|---|
| RECRUITING | 정원 10 |
| CAPTAIN_PICK | 팀장 **2명** |
| POINT_ALLOC | 동일 (기본 1000, 조정 가능) |
| BIDDING | 비-팀장 8명 대상 |
| PLACEMENT | 각 팀 4인 + 팀장 1인 = 5명, **2팀** |
| BRACKET_SETUP | **없음** — 1매치만, BO1 또는 BO3 선택 |
| IN_GAME | 1매치 (단판 또는 Bo3) |
| COMPLETED | 매치 우승 팀 표시 |

> **결정 필요**: 10인에서도 같은 코드 경로 (BRACKET_SETUP 단계만 skip) 인지, 별도 stage 인지. 기본안: 같은 경로, BRACKET_SETUP 이 자동 진행 (자동으로 IN_GAME 으로).

---

## 7. 데이터 모델 (D1 스키마)

### 7.1 통합 / 격리 원칙

- **모집 / 토너먼트 메타 / 경매 입찰** = 별도 테이블 (`auction_*`) — UX·lifecycle 이 다름
- **매치 (`series`) / 게임 / 픽 / 밴 / 통계** = **기존 테이블 재사용** + `series.type='AUCTION'` 마킹
- **MMR 변동** = `series.type='AUCTION'` 분기로 skip

### 7.2 기존 테이블 ALTER

```sql
-- series 에 type + auction_tournament 연결 컬럼 추가
ALTER TABLE series ADD COLUMN type TEXT NOT NULL DEFAULT 'RANKED';
ALTER TABLE series ADD COLUMN auction_tournament_id INTEGER REFERENCES auction_tournaments(id);

-- type 값: 'RANKED' (일반 내전, MMR 영향) | 'AUCTION' (경매 매치, MMR skip)
-- auction_tournament_id: RANKED 면 NULL. AUCTION 이면 토너먼트 FK.
-- 한 토너먼트 (20인) 에 series 가 3개까지 (4강 2 + 결승 1), 10인은 1개.

-- 인덱스 — type 별 조회
CREATE INDEX IF NOT EXISTS idx_series_type ON series(type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_series_auction_tournament ON series(auction_tournament_id) WHERE auction_tournament_id IS NOT NULL;
```

`game_picks`, `game_bans`, `game_stats` 는 **그대로** — series 단위로 묶이고, series.type 으로 자동 분리/통합.

### 7.3 신규 테이블 (경매 메타만)

```sql
-- 7.3.1 모집 (별도 — lifecycle 다름)
CREATE TABLE auction_recruitments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_id INTEGER NOT NULL,
  target_count INTEGER NOT NULL,             -- 10 or 20
  status TEXT NOT NULL,                       -- OPEN | CLOSED | CONVERTED | CANCELLED
  converted_tournament_id INTEGER,            -- → auction_tournaments.id (1:1)
  created_by TEXT NOT NULL,
  channel_id TEXT,
  message_id TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE auction_recruitment_participants (
  recruitment_id INTEGER REFERENCES auction_recruitments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  joined_at INTEGER DEFAULT (unixepoch()),
  PRIMARY KEY (recruitment_id, user_id)
);

-- 7.3.2 토너먼트 (한 경매내전 행사 — 4강 + 결승 = 한 토너먼트, 10인은 1매치 토너먼트)
CREATE TABLE auction_tournaments (
  id INTEGER PRIMARY KEY,                     -- 명시 부여 = auction_recruitment.id (v0.3.4 패턴)
  season_id INTEGER NOT NULL,
  format INTEGER NOT NULL,                    -- 10 or 20
  status TEXT NOT NULL,                       -- CAPTAIN_PICK | POINT_ALLOC | BIDDING | PLACEMENT | BRACKET_SETUP | IN_GAME | COMPLETED | CANCELLED
  champion_team_id INTEGER,                   -- 우승 팀 → auction_teams.id
  started_at INTEGER DEFAULT (unixepoch()),
  ended_at INTEGER,
  created_by TEXT NOT NULL,
  end_card_channel_id TEXT,                   -- 종료 카드 (v0.4.3 패턴)
  end_card_message_id TEXT,
  deleted_at INTEGER
);

-- 7.3.3 팀 (한 토너먼트 안의 2팀 / 4팀)
CREATE TABLE auction_teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL REFERENCES auction_tournaments(id) ON DELETE CASCADE,
  team_index INTEGER NOT NULL,                -- 1..4 (20인) 또는 1..2 (10인)
  captain_user_id TEXT NOT NULL,
  team_name TEXT,                             -- 운영자가 옵션으로 부여 가능
  initial_points INTEGER NOT NULL DEFAULT 1000,
  current_points INTEGER NOT NULL DEFAULT 1000,
  UNIQUE (tournament_id, team_index)
);

-- 7.3.4 팀원 (낙찰 + 수동 배치)
CREATE TABLE auction_team_members (
  team_id INTEGER NOT NULL REFERENCES auction_teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  acquired_via TEXT NOT NULL,                 -- BID | MANUAL
  acquired_at_points INTEGER,                 -- 낙찰 포인트 (수동 배치는 NULL)
  PRIMARY KEY (team_id, user_id)
);
-- 라인 (TOP/JUNGLE/...) 은 series_participants.role 에 저장 — 매치 시작 시점에 결정.

-- 7.3.5 입찰 기록 (audit)
CREATE TABLE auction_bids (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL REFERENCES auction_tournaments(id) ON DELETE CASCADE,
  target_user_id TEXT NOT NULL,
  team_id INTEGER NOT NULL REFERENCES auction_teams(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  is_final BOOLEAN DEFAULT FALSE,             -- 낙찰 입찰만 TRUE
  created_at INTEGER DEFAULT (unixepoch())
);

-- 7.3.6 토너먼트 매치 메타 — 기존 series 와 1:1 매핑
-- (series 가 곧 한 매치 — BO1 또는 BO3 자체 lifecycle)
CREATE TABLE auction_matches (
  series_id INTEGER PRIMARY KEY REFERENCES series(id) ON DELETE CASCADE,
  tournament_id INTEGER NOT NULL REFERENCES auction_tournaments(id) ON DELETE CASCADE,
  round TEXT NOT NULL,                        -- SEMI | FINAL | SINGLE (10인)
  bracket_index INTEGER,                      -- 4강 매치 1/2 구분 (NULL for FINAL/SINGLE)
  team1_id INTEGER NOT NULL REFERENCES auction_teams(id),
  team2_id INTEGER NOT NULL REFERENCES auction_teams(id),
  UNIQUE (tournament_id, round, bracket_index)
);
```

### 7.4 통합 흐름 (자연스럽게 동작하는 것들)

| 흐름 | 동작 |
|---|---|
| 게임 결과 INSERT | `games` (series_id 가 AUCTION type) — 같은 테이블 |
| 픽/밴 INSERT | `game_picks` / `game_bans` — 같은 테이블 |
| 게임 통계 | `game_stats` (W/L per user/role) — 같은 테이블 |
| 사용자 챔프 누적 | `game_picks` 쿼리 — 별도 분기 없이 자동 통합 |
| `/내전기록` 라인별 W/L | `game_stats` 쿼리 — 자동 통합 (auction 게임도 포함) |
| BalancePreview 의 챔프 Top5 | `game_picks` 쿼리 — 자동 통합 |

### 7.5 격리 흐름 (분기 코드 필요)

```ts
// apps/api/src/http/games.ts — recordGame 흐름
const series = await db.getSeries(seriesId);
if (series.type === "AUCTION") {
  // auction 경로: mmr 부분 완전 skip
  await db.recordGameOnly({ seriesId, gameNumber, winningTeam, team1Side, stats, durationSec });
  // game + game_stats + game_picks + game_bans 만 INSERT, mmr_changes / user_lane_mmr 안 건드림
} else {
  // 일반 경로: 기존 recordGameAndUpdateMmr
  await db.recordGameAndUpdateMmr({ ... });
}
```

`getLeaderboard` / `/랭킹` 등은 `user_lane_mmr` 쿼리 → auction 은 그 테이블에 안 들어가므로 자동 격리.

`countSeriesWins` / `completeSeries` 등 series-level 흐름은 type 무관 동일 (BO3 종료 검사 등은 series 단위 동일).

### 7.6 마이그레이션

- `packages/core/src/db/schema.sql` 에 `ALTER series ADD COLUMN type` + `auction_tournament_id` + 6개 신규 테이블 (`auction_recruitments`, `auction_recruitment_participants`, `auction_tournaments`, `auction_teams`, `auction_team_members`, `auction_bids`, `auction_matches`) 추가
- 기존 idempotent ALTER ADD COLUMN 패턴 사용 — `type` 컬럼 default `'RANKED'` 라 기존 데이터 자동 호환
- 백워드 호환: 기존 쿼리 모두 동작 (type 무시), MMR 흐름도 default RANKED 로 그대로 작동

---

## 8. API 엔드포인트 (초안)

기존 `apps/api/src/http/` 와 같은 위계로 별도 라우트:

```
GET    /api/auction-recruitments                   목록 (운영자 / 대시보드용)
GET    /api/auction-recruitments/:id                상세
POST   /api/auction-recruitments/:id/members        강제 추가 (운영자)
DELETE /api/auction-recruitments/:id/members/:uid   강제 제거
POST   /api/auction-recruitments/:id/cancel         취소
POST   /api/auction-series                          recruitment → series 전이 (CAPTAIN_PICK 진입)

GET    /api/auction-series/:id                      상세 (전체 state machine 포함)
PUT    /api/auction-series/:id/captains             팀장 4명/2명 set
PUT    /api/auction-series/:id/points               팀별 initial_points 조정
POST   /api/auction-series/:id/draw                 🎲 다음 인원 추출 (서버가 random 선택)
POST   /api/auction-series/:id/bids                 입찰 기록 INSERT
POST   /api/auction-series/:id/finalize-bid         낙찰 확정 (배치 + 포인트 차감)
POST   /api/auction-series/:id/unsold               유찰 처리
POST   /api/auction-series/:id/manual-assign        수동 배치
POST   /api/auction-series/:id/start-bracket        BRACKET_SETUP 진입
PUT    /api/auction-matches/:id/format              BO1/BO3 결정
POST   /api/auction-matches/:id/games               게임 결과 + 픽/밴 기록
DELETE /api/auction-matches/:id/games/last          직전 게임 되돌리기
POST   /api/auction-series/:id/revert               PLACEMENT → BIDDING 등 단계 되돌리기
POST   /api/auction-series/:id/cancel               시리즈 강제 취소

POST   /internal/auction-recruit-refresh            api → bot (모집 메시지 갱신)
POST   /internal/auction-series-completed           api → bot (종료 카드 발행, v0.4.3 패턴)
```

WS topics:
- `auction:dashboard` (목록)
- `auction-recruitment:N` (단일 모집)
- `auction-series:N` (단일 시리즈 — 경매 진행 / 매치업 / 게임)

---

## 9. UX 화면 구성 (와이어프레임)

### 9.1 AuctionDraft (CAPTAIN_PICK → PLACEMENT)

```
┌─────────────────────────────────────────────────┐
│ 🎟️ 경매내전 #12 — 20인 · CAPTAIN_PICK            │
│ ─────────────────────────────────────────────── │
│ [팀장 후보 — 20명]                              │
│  [👤 a]  [👤 b]  [👤 c] ...                     │
│  클릭하면 팀장으로 지정 (현재 0/4)              │
│                                                  │
│ [팀장 (지명됨)]                                 │
│  ① 비어있음   ② 비어있음   ③ 비어있음   ④ 비어있음 │
│                                                  │
│ [▶ 다음 단계로]  (4명 다 차야 활성)             │
└─────────────────────────────────────────────────┘
```

POINT_ALLOC 단계:
```
[팀장별 포인트]
 ① a   ▢ 1000    ② b   ▢ 1000    ③ c   ▢ 1000    ④ d   ▢ 1000
                                                          [▶ 경매 시작]
```

BIDDING 단계:
```
┌─────────────────────────────────────────────────┐
│ 🎲 다음 인원                       [🎲 추출]    │
│ ─────────────────────────────────────────────── │
│       📦 현재 매물: 비어있음                    │
│  (또는)                                          │
│       📦 현재 매물: e (4번째 매물)              │
│                                                  │
│ [팀장별 입찰]                                   │
│  ① a (잔 850)   [▢ 입찰]  [✓ 낙찰]              │
│  ② b (잔 1000)  [▢ 입찰]  [✓ 낙찰]              │
│  ③ c (잔 920)   [▢ 입찰]  [✓ 낙찰]              │
│  ④ d (잔 780)   [▢ 입찰]  [✓ 낙찰]              │
│                                                  │
│ [유찰 처리]                                     │
│                                                  │
│ ─── 현재 팀 구성 ─────────────────────────────  │
│ ① a  | f, g                                     │
│ ② b  |                                          │
│ ③ c  | h                                        │
│ ④ d  |                                          │
│                                                  │
│ [유찰 리스트 (3): i, j, k]                      │
│ ─────────────────────────────────────────────── │
│ [▶ 경매 종료 → 토너먼트] (모두 배치돼야 활성)   │
└─────────────────────────────────────────────────┘
```

### 9.2 AuctionBracket (BRACKET_SETUP → IN_GAME)

```
┌─── 4강 ───────────────┐  ┌─── 결승 ────┐
│ ① a 팀 ── BO3 ── ▶    │  │             │
│            VS ────────│──▶   ? VS ?    │
│ ④ d 팀 ── BO3 ──      │  │             │
│                        │  │ [BO3 ▼]    │
│ ② b 팀 ── BO1 ── ▶    │  │             │
│            VS ────────│──▶             │
│ ③ c 팀 ── BO1 ──      │  └─────────────┘
└────────────────────────┘

각 매치 클릭 → MatchupPanel 펼침 (게임별 픽/밴 입력)
```

### 9.3 AuctionResult (COMPLETED)

```
🏆 경매내전 #12 종료 — ② b 팀 우승!

[4강]
  매치 1: ① a (3-1) vs ④ d
  매치 2: ② b (3-0) vs ③ c

[결승]
  ② b (3-2) vs ① a

[전체 게임 픽/밴] (collapsible)
  ...
```

---

## 10. MMR 격리 + 통합 — 구현 가드

### 10.1 코드 경로 분기

기존 `recordGameAndUpdateMmr` (`packages/core/src/db/record.ts`) 를 둘로 나눔:

```
recordGameOnly({...})            // game + game_stats + game_picks + game_bans INSERT
  └─ AUCTION 흐름에서만 호출

recordGameAndUpdateMmr({...})     // 위 + mmr_changes INSERT + user_lane_mmr UPDATE
  └─ RANKED 흐름에서만 호출
  └─ 내부적으로 recordGameOnly 부터 호출 후 mmr 부분 추가
```

`games.ts` 에서 series.type 에 따라 분기:

```ts
const series = await db.getSeries(seriesId);
if (series.type === "AUCTION") {
  await db.recordGameOnly({ ... });
} else {
  await db.recordGameAndUpdateMmr({ ... });
}
```

### 10.2 통합 통계 — 자연 동작 확인

| 동작 | 통합? | 메커니즘 |
|---|---|---|
| 사용자 라인별 W/L (`/내전기록`) | ✅ | `game_stats` 쿼리, type 무관 |
| 사용자 챔프 누적 (`game_picks` 기반) | ✅ | `game_picks` 쿼리, type 무관 |
| 시리즈 목록 (`/시리즈목록`) | 결정 필요 | type 필터 옵션? 기본은 type 무관? |
| 대시보드 "지난 내전" | 결정 필요 | type 표시 (`🎟️ 경매` 뱃지) + 같이 노출? 분리? |
| BalancePreview Top5 챔프 | ✅ | `game_picks` 쿼리, type 무관 |

→ §12 Q16, Q17 로 추가.

### 10.3 통합 테스트 가드 (필수)

```ts
describe("경매 게임 결과 — MMR 격리", () => {
  it("AUCTION series 의 game record 후 mmr_changes 행 0", ...)
  it("AUCTION series 의 game record 후 user_lane_mmr 변동 없음", ...)
  it("getLeaderboard 가 AUCTION 게임을 제외", ...)
  it("`/랭킹` 시즌 MMR 이 AUCTION 게임을 제외", ...)
})

describe("경매 게임 결과 — 통계 통합", () => {
  it("`/내전기록` 라인별 W/L 에 AUCTION 게임 포함", ...)
  it("사용자 챔프 누적 (game_picks) 에 AUCTION 픽 포함", ...)
  it("BalancePreview Top5 챔프에 AUCTION 픽 포함", ...)
})
```

---

## 11. 작업 단계 (구현 phase 제안)

| Phase | 내용 | 예상 |
|---|---|---|
| A | DB schema — `series` ALTER (type + auction_tournament_id) + 7개 신규 테이블 (`auction_recruitments`, `auction_recruitment_participants`, `auction_tournaments`, `auction_teams`, `auction_team_members`, `auction_bids`, `auction_matches`). `recordGame` 분기 (`recordGameOnly` 추출) + MMR 격리 / 통계 통합 테스트 가드. | 4~6h |
| B | api 라우트 (모집 → 토너먼트 전이 + 팀장 + 포인트 + 입찰 + 배치 + 매치 생성 + 게임 결과) + 통합 테스트 | 8~12h |
| C | 봇 슬래시 (`/경매내전모집` + 인원관리 + 강제삭제) + 채널 메시지 빌더 | 4~6h |
| D | Activity AuctionDraft 화면 (CAPTAIN_PICK → POINT_ALLOC → BIDDING → PLACEMENT) | 8~12h |
| E | Activity AuctionBracket 화면 (BRACKET_SETUP → IN_GAME — 4강 / 결승) | 6~10h |
| F | Activity AuctionResult + 종료 카드 자동 발행 (v0.4.3 패턴 재사용) | 2~3h |
| G | MMR 격리 통합 테스트 + 회귀 검증 | 2h |
| H | 10인 경로 검증 (Phase D~F 의 변형 동작) | 1~2h |
| **합계** | | **~35~50h** |

릴리스 전략 — 큰 작업이므로 **feature flag** 권장: `AUCTION_ENABLED=true` env 가 없으면 슬래시 등록 X / Activity 라우트 hidden. 점진 베타 → 운영 전환.

---

## 12. Open Questions

> 구현 시작 전 결정 필요.

| # | 질문 | 기본안 |
|---|---|---|
| Q1 | 10인 경매에서도 같은 코드 경로 (BRACKET_SETUP 자동 skip)? | Yes, 같은 경로 |
| Q2 | 팀장 선출 방법 — 자유 클릭? UserSelectMenu? 자기추천 허용? | 자유 클릭 (참가자 명단 안에서). 자기추천 허용. |
| Q3 | 4강 대진 결정 방법 — 팀장 입찰 순서? 운영자 수동? 추첨? | 운영자 수동 (좌측 패널에서 4팀 드래그&드롭) |
| Q4 | 입찰 단위 / 최소 금액 / 동률 처리 | 1 포인트 단위 · 최소 0 · 동률 시 운영자가 어느 팀에 줄지 선택 |
| Q5 | 한 매물 입찰 중 후 입찰 더 들어오면 (보이스로) 어떻게 트래킹? | 운영자가 "최종 입찰" 값만 기입하면 충분 — 중간 입찰은 audit 안 함 (사용자 의도 확인) |
| Q6 | 유찰자 재경매 시 동일 절차? 포인트 그대로? | Yes, 같은 절차 |
| Q7 | 운영자 수동 배치 시 포인트 영향? | 포인트 무관 — `acquired_via='MANUAL'`, `acquired_at_points=NULL` |
| Q8 | 라인 (TOP/JUNGLE/MID/BOTTOM/SUPPORT) 결정 시점 — 경매 시점? 픽/밴 시점? | 픽/밴 시점 — 매치 시작 직전에 운영자가 라인 배치 (BRACKET_SETUP 안에 라인 슬롯) |
| Q9 | 경매내전 챔프/밴은 일반 전적 (`/전적` `/내전기록`) 에 같이 노출? | **통합** (user 결정 2026-05-12). `game_stats` / `game_picks` 같은 테이블 공유, type 무관 누적. |
| Q10 | hard fearless 룰 (Bo3 안 같은 챔프 금지) 적용? | Yes — 매치 안에서 fearless. 매치 간 (4강 → 결승) 은 미적용 (다른 매치업) |
| Q11 | 종료 카드의 정보량 — 일반 종료 카드 (v0.4.3) 와 같은 수준? | Yes, 같은 수준 + 토너먼트 사다리 시각화 |
| Q12 | 모집 정원 다른 옵션 — 16인? 8인? | 일단 10/20 만, 추가 정원은 향후 |
| Q13 | 경매내전 시즌 분리? 일반 시즌과 같은 ID 공유? | 같은 `season_id` 공유 (자동 시즌 전환 시 같이 전환) |
| Q14 | 팀장 본인이 픽/밴을 할 수 있는지 | 팀장도 팀의 일원 — 라인 배정 시 자기 라인 정함 |
| Q15 | 입찰 중 운영자가 실수했을 때 되돌리기 — 매물 단위? 입찰 단위? | 매물 단위 (낙찰 취소 → 매물 다시 BIDDING, 차감 포인트 복원) |
| Q16 | `/시리즈목록` / 대시보드 "지난 내전" 에 AUCTION 매치 포함? | 포함 + `🎟️ 경매` 뱃지 노출 (분리 필터 옵션 가능) |
| Q17 | BalancePreview Top5 챔프 (라인별) 에 AUCTION 픽 포함? | 포함 — 통합 통계 원칙 일관. |
| Q18 | AUCTION 매치의 시리즈 / 모집 강제삭제 흐름은 일반과 동일? | 동일 — `series.type` 만 차이, soft-delete / revert 동일 패턴 |

---

## 13. 비목표 / 향후

- **자동 매칭 / 추천 입찰** — 운영자 수동만 (도메인 핵심)
- **공개 입찰 — 참가자가 직접 입찰 버튼 클릭** — 운영자 중심 (보이스 협의 결과만 기록)
- **포인트 인플레이션 / 시즌 누적** — 1회성 1000 포인트, 다음 경매에 영향 없음
- **시상 / 보상 시스템** — 별도 외부 인센티브 (시즌 통계 무관)
- **경매 MMR / 라인 MMR 별도 누적** — 경매는 MMR 영향 0. 일반 MMR 만 의미 있음.
- **별도 "경매 전적" 페이지** — 통합 통계에 자연 반영, 별도 페이지 불필요 (Q9 결정).

---

## 14. 결정 후 다음 단계

위 [§12 Open Questions](#12-open-questions) 답변 받으면:

1. 본 문서를 최종안으로 확정
2. ROADMAP.md 에 백로그로 추가 (또는 즉시 Phase 17 시작 항목)
3. Phase A (DB schema) 부터 순차 진행

릴리스는 작은 단위로 (Phase A → B 검증 → C 검증 → ... ) 가는 게 안전. `AUCTION_ENABLED` feature flag 가드 권장.
