# Roadmap

> 현재 버전 기준 진척 상태. 시간순 기획서는 [`PLAN.md`](./PLAN.md), 코드 리뷰 워킹노트는 [`docs/internal/`](./docs/internal/) 참조.

## 현재 (v0.5.7)

활성 도메인: `bot.mooklol.com` (Cloudflare proxied → 단일 VPS · Docker compose 4컨테이너 stack: bot · api · activity · nginx).
실서비스 운영 중.

## ✅ 완료 (Shipped) — 시간순 (오래된 → 최신)

### Phase 0 — 분리 (v0.1.0~0.1.1)
- 모노레포 스캐폴드 (`apps/{api,bot,activity}`, `packages/core`)
- v1 코드의 도메인 로직 → `packages/core` 이식 (D1 클라이언트, Riot API, MMR/ELO, Data Dragon)
- D1 마이그레이션 (`pnpm --filter @mookbot/core db:migrate`)

### Phase 1 — Activity 기초 (v0.1.3~0.2.0)
- 도메인 + Cloudflare TLS + nginx 단일 호스트 path-based routing
- Discord Developer Portal Activity 셋업 (URL Mappings, Supported Platforms)
- `apps/api` Fastify 부트 + OAuth2 token exchange
- `apps/activity` Vite + React + daisyUI 부트
- 세션 검증 흐름 정착

### Phase 2 — 4단계 시리즈 라이프사이클 (v0.2.0~0.2.7)
- **모집**: `/내전모집` + Components V2 메시지 + 멤버 추가/제거
- **엔트리 수정**: 드래그 & 드롭 슬롯 보드 + 후보 풀 + 시리즈 INSERT
- **대기실**: `LineupPreview` 카드
- **픽/밴 + 결과**: Data Dragon 챔프 그리드 + Hard Fearless 룰 + Bo3 자동 종료 + 되돌리기
- WebSocket 룸 + `/internal/notify` 채널 알림 (봇 ↔ api 내부 RPC, shared secret 인증)

### Phase 3 — 슬래시 명령어 (v0.2.2~0.2.7)
- 조회: `/등록`, `/내정보`, `/내전기록`, `/랭킹`, `/전적`, `/지금게임`
- 운영: `/내전모집`, `/일괄등록`
- 운영자 role 게이트 골격 마련 (`apps/api/src/auth/perms.ts`, `apps/bot/src/utils/operator.ts`) — 단, 실제 enforcement 는 v0.3.23 에서 완성 (그 전까진 env 미설정 시 모두 허용 fallback 로 사실상 무력화돼 있었음).

### Phase 4 — 운영 안정화 (v0.2.3~0.2.8)
- SSL Full(strict) 전환
- D1 자동 백업 (GitHub Actions, 03:00 KST — 트래픽 0 가정)
- 운영자 슬래시: 시리즈/모집 강제 삭제, MMR 수동 조정
- 에러 알림 Discord webhook (격리된 채널)
- 4컨테이너 헬스체크 + 외부 모니터링

### Phase Q — 코드 품질 Wave 1~6 (2026-04-30 ~ 05-01)
- **W1**: biome 2.4.13 + CI lint/typecheck
- **W2**: vitest + 단위 테스트 (mmr / riot / riotIdExtract)
- **W3**: God-file 분해 (PickBan 1530→507, routes 850→22, EntryEditing 802→460, recruit 664→74)
- **W4**: env validation (zod) + Fastify 글로벌 에러 핸들러 + console.* → 구조화 로그
- **W5**: 통합 테스트 94개 (core db 42 + API route 10), coverage 약 36%
- **W6**: Node 22 + 의존성 최신화 + pino-abstract-transport 3 (vite 8 보류)

### Phase 5 — Activity 신규 기능 (v0.3.0~0.3.3)
- 리더보드 + 유저 프로필 (v0.3.0)
- 사다리 픽밴 가로대 fade-in (v0.2.16)
- 미니게임 신규 (원판) + QA 수정 (v0.2.15)
- 신규 사용자 안내 카드 (v0.3.1)
- CI lint 회복 (v0.3.2)
- 사용자 노출 mookbot → monkey 리네임 (v0.3.3)

### Phase 6 — 안전성 + 관측성 + UX (v0.3.4~0.3.5)
- **시리즈 soft-delete** (v0.3.4) — `deleted_at` 컬럼, revert/cleanup-stale/force-delete/season-reset 모두 통합. 같은 id 재생성 시 자동 revive — revert 후 재확정 흐름 자연스럽게 처리.
- **모집 ID = 시리즈 ID 매칭** (v0.3.4) — `createSeries` 가 명시적 id (= recruitmentId) 부여. 사용자가 "모집 #N → 시리즈 #N" 1:1 인지.
- **revert audit log** (v0.3.4) — `series.revert` 액션 기록. 기존 force-delete 와 동등 추적성.
- **api → 봇 메시지 sync 후크** (v0.3.4) — `POST /api/series` + revert 후 봇이 Discord 모집 메시지 즉시 갱신 (이전 stale 문제 해결).
- **`/로그` 슬래시 + `/api/logs` 웹뷰** (v0.3.5) — operator-only 60분 JWT 링크. SSR HTML 단일 파일, action/operator/시간/limit 필터 + cursor 페이지네이션. D1 쿼리 없이 audit 즉시 확인.
- **`/시리즈목록` 슬래시** (v0.3.5) — 상태/시즌/limit 필터, 임베드 출력 (시리즈 ID, status, Bo3 스코어, 라인업 N v N, 시즌, 시작일, 운영자).
- **밸런스 이미지 미리보기 (SVG)** (v0.3.5) — 엔트리 확정 + Game 1 사이드 결정 후 PickBan 화면에 양 팀 라인업 + 라인별 MMR + 평균 MMR 자동 노출. 외부 의존성 0 (canvas/sharp 불필요).

### Phase 7 — Activity 신규 기능 + 사용자 신원 (v0.3.6~0.3.8)
- **선호 챔프 등록 페이지** (v0.3.6) — 게시판 텍스트 풀이 ("탑- 제이스, 케넨, ...") 의 페이지 대체. `user_champion_preferences` 테이블 + GET (누구나 조회) / PUT (본인) API. Profile 안 collapsible "📌 선호 챔프" 섹션 + 라인별 챔프 그리드 모달 (PickBan ChampCell 재사용). 라인당 최대 10개, 입력 순서 보존.
- **사용자 검색 (op.gg 스타일)** (v0.3.7) — navbar 가운데 input. `display_name` + Riot `game_name` 부분일치, 결과 드롭다운 → 클릭/Enter 로 Profile 즉시 진입. `searchUsers` (LEFT JOIN + DISTINCT + LIKE), debounce 200ms, "/" 단축키, ↑↓/Enter/Esc 네비.
- **navbar 검색창 정중앙 고정** (v0.3.8) — daisyUI `navbar-start/center/end` 패턴으로 좌우 그룹 너비와 무관한 정중앙.

### Phase 8 — 디자인 시스템 재구축 (v0.3.9~0.3.18)
- **Phase A** (v0.3.9) — Navbar 재구축. 좌측 `ContextChip` (현재 stage 한 줄), 가운데 검색바 `max-w-md`, 우측 `SystemDot` + 통합 `username▾` dropdown (🏆/🎲/❓ + 운영자 뱃지 메뉴 통합). 평등하게 늘어선 5 아이콘 → primary 1개로 정리.
- **Phase B** (v0.3.10) — 대시보드 재구축. `MeHero` (op.gg 스타일 본인 카드 — 표시명/메인 라이엇/시즌 W/L + 라인별 MMR 5칸) 신규. 기존 stats-horizontal 3-stat 바 제거.
- **Phase C** (v0.3.11) — 디자인 토큰. `index.css` `@layer components` 에 `surface-base/soft/quiet`, `card-action`, `card-status-{waiting/progress/completed/me}` 정의. 화면별 카드 패턴 통일.
- **Phase D** (v0.3.12) — Steps 재배치 (LIST/MINIGAME/LEADERBOARD/PROFILE 에서 숨김, 시리즈 라이프사이클 안에서만) + 모바일 검색 토글 (`< md` 에서 🔍 → navbar 아래 펼침).
- **Phase E** (v0.3.13) — daisyUI avatar/avatar-placeholder 도입. `UserAvatar` 컴포넌트 — discordId 해시로 7색 일관 매핑 + ring 옵션. 모든 사용자 표시 위치 (MeHero/SearchBar/Profile/Leaderboard) 통일. status dot 강화, divider 도입.
- **Phase F** (v0.3.14) — 데이터 시각화. `UserAvatar` 에 `imageUrl` 옵션 (이미지 모드). LaneMmrCard 에 `radial-progress` (라인별 승률 도넛).
- **Phase G** (v0.3.15) — API `topChampion` 확장. 검색/리더보드 응답에 `topChampion` (메인 챔프) 추가 + 닉네임 옆 "주력 OOO" 캡션.
- **Phase H** (v0.3.16) — `theme-controller` (라이트/다크 토글, dropdown 안 설정 항목). localStorage 자동 영속.
- **Phase J** (v0.3.17) — daisyUI footer 단축키. 페이지 하단 4-button grid (📇 내 프로필 / 🏆 리더보드 / 🎲 도구 / ❓ 도움말). LIST/LEADERBOARD/MINIGAME/PROFILE 에서만 노출 (시리즈 흐름 산만 방지).
- **Phase I** (v0.3.18) — `SeriesResult` 게임 진행 daisyUI vertical timeline. 승리팀 색상 dot + chronology 시각 강조.
- **drawer / breadcrumbs / filter / swap / rating / toggle / fab** — 명확한 사용처 부족 또는 도메인 비목표 (모집 컨트롤 등) 로 보류.

### Phase 9 — 사용자 아바타 = League 소환사 아이콘 (v0.3.19~0.3.20)
- **챔프 splash → 소환사 아이콘 정정** (v0.3.20) — 사용자 의도는 RP/BE 로 구매하는 League 소환사 아이콘. `riot_accounts.profile_icon_id` 컬럼 추가 (Summoner-V4 의 `profileIconId` 캐시).
- **자동 fetch + 백필**: 봇 `/등록` + `/일괄등록` 흐름이 `getSummonerByPuuid` 호출, `linkRiotAccount` / `upsertRiotAccountIdentity` 가 `profileIconId` 같이 저장. `pnpm --filter @mookbot/core backfill:profile-icons` 스크립트로 기존 등록자 일괄 백필 (rate-limit 250ms).
- **API 응답 확장**: `/api/users/:id/profile`, `/search`, `/leaderboard`, `/leaderboard/composite` 응답에 `profileIconUrl` 추가.
- **Activity UserAvatar 우선순위**: `profileIconUrl` (소환사 아이콘) > `splashUrl` (챔프 loading art) > `iconUrl` (챔프 icon) > placeholder.

### Phase 10 — 운영자 권한 단일화 + 안정화 핫픽스 (v0.3.21~0.3.26)
- **Sticky footer** (v0.3.21) — 루트 컨테이너 `flex flex-col` + `<main>` `flex-1` 추가. 콘텐츠 짧은 화면에서 footer 가 viewport 중간에 떠있던 문제 수정.
- **픽/밴 일괄 입력 "모두 적용" 누적 버그** (v0.3.22) — `BulkInput.applyAll()` 이 4영역마다 `onApply` 4회 연속 호출 → 각 호출이 같은 `gameDraft` prop 기반 새 객체 생성 → 부모 `setDraft((prev) => ...)` 가 동일 prev 에 4번 덮어쓰기 → 마지막 (`TEAM_2 ban`) 만 반영되던 버그. `onApply` 시그니처를 다중 변경 array 로 변경, `handleApplyBulk` 가 같은 `next` 위에 누적 후 단일 `onChange()` 호출하도록 수정.
- **운영자 권한 = `BalanceTeam` 역할 단일화** (v0.3.23) — 기존 `OPERATOR_ROLE_ID`/`OPERATOR_ROLE_NAME` dual-path + "env 미설정 시 모두 허용" fallback 제거. 코드 기본값 `"BalanceTeam"` (env 로 override 가능). 길드에서 역할 미발견 시 fail-secure deny. `apps/api/src/auth/perms.ts` + `apps/bot/src/utils/operator.ts` 동시 적용. 테스트는 globalThis Symbol 기반 `__setCanEditOverrideForTest` 훅으로 vi.mock 없이 분기. **실제 영향**: v0.3.23 전까진 `bot/.env` 의 OPERATOR 설정이 비어있어서 (api 만 ID 설정) 봇 슬래시 운영자 명령은 누구나 실행 가능 상태였음 — 이번 릴리즈로 양쪽 모두 BalanceTeam 보유자만 통과. VPS env (`/root/deploy/{api,bot}/.env`) 도 정리 — `OPERATOR_ROLE_ID` 제거, `OPERATOR_ROLE_NAME=BalanceTeam` 명시.
- **권한 진단 모달 노출** (v0.3.24) — Activity dropdown 의 "내 권한 확인" 항목. `apps/api/src/auth/perms.ts:diagnosePerms` 의 결과 (BalanceTeam 보유 여부 / 운영자 역할 ID / 본인 길드 role 목록) 를 모달로 표시. v0.3.23 단일화 직후 자가진단 도구 — "왜 ⛔ 가 떠?" 응답을 사용자가 직접 확인 가능. 신규 `apps/activity/src/components/PermsModal.tsx`.
- **세 가지 후속 정리** (v0.3.25):
  - `operatorRoleConfigured` 응답 필드 제거: v0.3.23 이후 항상 `true` 라 의미 없는 필드. `apps/api/src/http/auth.ts` + `apps/activity/src/state/perms.tsx` + `apps/activity/src/App.tsx` 정리. dropdown 의 ✏️/👁 뱃지는 항상 표시.
  - `pnpm deploy:vps` 자동화 스크립트 (`scripts/deploy-vps.sh`): preflight (working tree clean + main 동기화) → `docker:release` → `ssh root@141.164.46.191 ... compose pull && up -d` → health check. 매 release 마다 같은 시퀀스 반복하던 것을 한 명령으로.
  - `.claude/settings.json` biome format 적용 — 잔존 1 error 정리, `pnpm check` 가 깨끗.
- **audit log 커버리지 확장** (v0.3.26) — 기존 destructive action (force-delete*, season-reset, mmr.adjust, series.early-complete, series.revert, cleanup-stale) 만 audit 되던 것을 정상 lifecycle 까지 확장. 신규 actions: `series.created`, `series.completed`, `game.recorded`, `game.undone`, `recruitment.created`, `recruitment.cancelled`, `recruitment.closed`. `/로그` 웹뷰가 진짜 운영 타임라인이 됨 — 누가 언제 모집을 만들었고 어떤 게임을 기록했는지까지 추적. pickban draft 저장은 너무 빈번해 제외 (game.recorded 가 최종 결과 캡처).

### Phase 11 — 권한 캐시 fix + 라이엇 self-service + 페이지네이션 (v0.4.0)

> v0.3.26 이후 별도 patch 없이 한 번에 v0.4.0 으로 묶음 release.

**권한 캐시 오염 fix**
- `apps/api/src/auth/perms.ts:getRoles` 가 `fetchGuildMember` 일시 실패 (Discord API 5xx / rate limit) 결과를 빈 배열로 60s 캐시해, 운영자가 권한 없는 사용자로 처리되던 long-standing 버그. "Activity 껐다 켜면 회복" 증상이 단서. 실패 시 캐시 안 함 (다음 요청 재시도) + 클라이언트 `PermsProvider` 가 `focus`/`visibilitychange` 이벤트에 자동 refresh + 에러 시 기존 me 보존 (downgrade 금지) + `PermsModal` 의 "↻ 재확인" 버튼 (수동 회복 경로) + 회귀 테스트 3건.

**BalancePreview HTML 재구현 + 챔프 풀 expand**
- SVG fetch (외부 share 무용지물 placeholder) 제거 → 클라이언트 props 로 직접 HTML 렌더. 라인별 매치업 카드의 각 플레이어 행을 펼치면 "내전 챔프 Top5" (icon + 이름 + W/L + WR%) 노출. "전체 열기/닫기" 토글로 일괄 펼치기. SVG 엔드포인트 자체는 미래 Discord webhook 업로드 용으로 서버에 보존. `/api/series/:id` 응답에 `laneMmr` 추가.

**EntryEditing 좌/우 swap 버튼**
- 1팀/2팀 라벨이 BLUE/RED 사이드 축과 시각 충돌하던 문제. 운영자가 직접 좌우 위치를 토글 가능 (assignment Map 의 모든 slot 에서 `TEAM_1` ↔ `TEAM_2` 일괄 swap). debounced entry-draft PUT 가 자동 동기화.

**봇 datadragon init 누락 fix**
- `apps/bot/src/index.ts` 가 `initDataDragon` 미호출 → `/전적` `/지금게임` 챔피언 이름이 `Unknown(<id>)` fallback 으로 노출되던 버그. API 와 동일한 fail-soft init 추가.

**K/D/A UI 제거**
- Profile recent games 의 K/D/A 표시 제거 + `/api/users/:id/profile` 응답에서 `kills/deaths/assists` 필드 제거. (CS 도 같은 제약이지만 누락 — v0.4.1 에서 후속 정리.) Riot production key / tournament API 인증 전까지 항상 0 이라 misleading. DB 컬럼 + `recordGame` 파라미터는 미래 인증 후를 위해 보존.

**라이엇 계정 self-service CRUD**
- Profile 페이지의 "✏️ 관리" 버튼이 새 stage `MY_RIOT_ACCOUNTS` 로 이동. 사용자가 자기 계정 (a) 목록 조회 (b) 신규 link (Riot API 검증 + profile_icon fetch) (c) 메인 전환 (d) 동기화 (Riot ID rename 추적 — `getAccountByPuuid` 신규 추가) (e) 연결 해제 가능. `linkRiotAccount` 호출 시 첫 계정만 자동 메인 — 그 외는 sub. 메인 해제 시 auto-promote 없음 (명시적 사용자 액션). 게임 기록은 discord_id 에 anchor 라 unlink 해도 MMR/전적 보존. 모든 변경 audit log 4 actions: `riot_account.linked` / `unlinked` / `main_changed` / `refreshed`. 5개 새 엔드포인트 모두 본인 한정 (sid 강제 WHERE 가드). 기존 `/등록` 슬래시는 first-time / 길드 운영 경로로 유지. 14개 통합 테스트.

**대시보드 페이지네이션**
- `/api/series/completed` 에 `offset` querystring 추가 + 응답에 `total` 포함 (`SELECT COUNT(*)` 추가 1쿼리). RecruitmentList 가 pending (recruitments+series) SWR 와 completed (page 별) SWR 분리 — page 변경 시 completed 만 refetch. PAGE_SIZE=8, daisyUI `join` 페이지 컨트롤 (« page X/N »). page 가 totalPages 초과 시 자동 클램프 (시리즈 삭제 후). 7건 통합 테스트.

### Phase 12 — BalancePreview 라인 필터 + UI 정리 (v0.4.1)
- **BalancePreview 챔프 Top5 — 라인별 필터** — 기존엔 사용자가 시즌 내 어떤 라인이든 픽한 챔프 합산 Top5 였음. 이제 그 사용자가 **이 시리즈에서 배정된 라인** 으로 플레이했을 때의 챔프만 노출 (정현이 TOP 배정 → TOP 라인으로 픽한 챔프 중 Top5). `/api/series/:id` history 에 `topChampionsByRole: Record<role, ChampionPlay[]>` 추가, SQL `GROUP BY user, role, champion` 1쿼리에서 라인별 + overall 둘 다 도출. 기존 `topChampions` (overall) 는 Profile 화면용 그대로 보존.
- **MMR ↔ collapse 화살표 겹침 fix** — daisyUI `collapse-arrow` 의 우측 ~24px 영역과 MMR 텍스트가 겹쳐 렌더되던 UI 버그. summary 내부 div 의 padding 을 `pr-3` → `pr-8` 로 확장.
- **"라인 평균 MMR 차" 라인 제거** — 이미 양 팀 평균 MMR 이 노출돼 있어 차이는 시각적으로 즉시 파악 가능, 별도 텍스트 줄은 잡음.
- **CS UI 제거** — v0.4.0 의 K/D/A 제거에서 누락된 CS 도 같은 제약. Profile recent games 의 `g.cs` 표시 + `RecentGame` 인터페이스 + `/api/users/:id/profile` 응답 모두에서 제거. DB 컬럼은 미래 인증 후를 위해 보존.

### Phase 13 — Wave 3.x 화면 상태 훅 추출 (v0.4.2)
- **`usePickBanState` 훅 추출** — `apps/activity/src/screens/PickBan/usePickBanState.ts` 신규. 기존 `PickBan.tsx` 안에 섞여 있던 `draft` state, debounced save, SWR (series/champions), WS sync, dirty 보호 onApply, 1/2/3 단축키, fearless 계산, derived (`teamSize`/`completedGames`/`t1Wins`/`t2Wins`/`team1Side`/`team2Side`/`isCurrentGameRecorded` 등), 액션 (`setSide`/`setCurrentGame`/`setGameDraft`/`revert`/`undoLast`) 을 hook 안으로 응집. `PickBan.tsx` 525 → 348줄 (-34%), navigation callback (`onBack`/`onSelectUser`) 과 `readOnlyDismissed` UI state 만 컴포넌트에 잔존.
- **`useEntryEditingState` 훅 추출** — `apps/activity/src/screens/EntryEditing/useEntryEditingState.ts` 신규. `assignment` state, debounced entry-draft save, SWR (recruitment), WS sync + ring pulse diff, Esc 키, Tap-to-Place 핸들러 (`handleParticipantTap`/`handleSlotTap`/`handlePoolTap`), `swapTeams`, `submit` (→ `{ seriesId } | null` 반환, navigation 은 컴포넌트가 처리), derived (`teamSize`/`activeLanes`/`unassigned`/`allFilled`) 모두 hook 으로. `EntryEditing.tsx` 488 → 270줄 (-45%).
- **회귀 영향 0** — 통합 테스트 256개 통과, biome lint baseline (8e/86w/6i) 대비 7e/83w/6i 로 개선 유지. server-side 동작 / WS 메시지 / 저장 흐름 / dirty 보호 정책 모두 동일 (로직 이동만, 변경 없음).
- **비목표 (다음 wave)**: hook 단위 vitest (renderHook + 모킹) — 별도 wave 로 미룸.

### Phase 14 — 시리즈 종료 카드 (모집 채널 자동 발행) (v0.4.3)
- **Bo3 종료 시 모집 채널에 결과 카드 자동 발행** — `/내전모집` 슬래시가 게시한 원본 채널에, Bo3 가 종료되는 순간 우승 팀 + 스코어 + 양 팀 라인업 + 게임별 픽 (라인별 챔프) 을 V2 컨테이너로 새 메시지 발행. v0.3.4 의 "모집 ID = 시리즈 ID" 매칭으로 채널 정보 자동 연결 (`recruitments.channel_id`).
- **흐름**: `apps/api/src/http/games.ts` 의 Bo3 자동 종료 분기 (`completeSeries` 직후) → `notifyBotSeriesCompleted(seriesId)` (X-Internal-Key shared secret) → 봇 `/internal/series-completed` → `publishSeriesEndCard(client, seriesId)`. fire-and-forget — 봇 호출 실패해도 게임 결과 INSERT / 시리즈 COMPLETED 자체는 성공 보장.
- **멱등성**: `series.end_card_message_id` (Phase 0 부터 schema 에 있던 미사용 컬럼) 을 활용. 이미 발행된 메시지가 있으면 edit, 없으면 send + DB 갱신. revert 후 재완료 시 같은 메시지가 갱신되어 채널 잡음 0.
- **edit 폴백**: 기존 메시지 fetch 시 50001 (Missing Access) / 10008 (Unknown Message) / 50013 (Missing Permissions) 발생 시 자동으로 새 send 로 폴백 + DB pointer 갱신 (모집 메시지 폴백 패턴 동일).
- **신규 파일**: `apps/bot/src/commands/series/endCardBuilder.ts` (renderEndCardComponents + publishSeriesEndCard), `packages/core/src/db/series.ts:setSeriesEndMessage` helper, `SeriesRow` 에 `end_card_channel_id` / `end_card_message_id` 필드 추가 (DB 컬럼은 기존).
- **신규 endpoint**: 봇 `POST /internal/series-completed` (`{seriesId}` body, X-Internal-Key 인증), api `notifyBotSeriesCompleted` helper (`apps/api/src/bot/notify.ts`).
- **운영 영향**: 새 환경변수 0, 새 DB 마이그레이션 0 (기존 미사용 컬럼 활용). `INTERNAL_API_KEY` / `BOT_INTERNAL_BASE` 그대로 재사용.

### Phase 15 — Wave 3.x 후속 hook 단위 vitest (v0.4.4)
- **35개 신규 테스트** — `usePickBanState.test.ts` 15건 + `useEntryEditingState.test.ts` 20건. happy-dom + `@testing-library/react` 새 dev dep, `@vitest-environment happy-dom` 주석으로 per-file 환경 분기 (다른 server-side 테스트는 node 환경 그대로).
- **mock 전략**: `useStaleWhileRevalidate` 를 mock 해서 `onApply` 캡처 + data 직접 제공 — SWR 사이클 통합 대신 hook 의 dirty 보호 로직만 격리 검증. `api/rest`, `api/ws`, `state/perms`, `components/Toaster` 도 mock. `usePickBanState` 의 hook 안 두 SWR 호출 (detail / champions) 은 호출 카운트의 짝/홀로 구분.
- **검증된 동작**: 첫 로드 (server draft 없음/있음), dirty 보호, `setSide`/`setCurrentGame`/`setGameDraft` (게임 게이팅 포함), `fearlessUsedIds` 도메인 계산 (이전 게임 + draft 합산, 현재 제외), `revert`/`undoLast` 성공/실패, debounced save (canEdit on/off), WS callback 시 refresh + toast, 1/2/3 단축키 (input 안 무시), `moveTo` (빈/점유 unassigned/점유 swap/null), `swapTeams`, `allFilled`, `submit` (성공/미충족/실패), Tap-to-Place 흐름 (`handleParticipantTap`/`handleSlotTap`/`handlePoolTap`, canEdit off 시 no-op), Esc 키 selected 해제, `recentlyChanged` diff.
- **vitest config**: `apps/activity/src/screens/*/use*State.ts` 만 coverage include 로 추가 (전체 activity src 는 UI 영역으로 exclude 유지).
- **테스트 총합**: 256 → 291 (+35). lint warnings 가 +20 (mock data 의 `!` non-null assertion — 테스트에서는 의도적 패턴, errors 0).

### Phase 24 — 경매 UX 후속 (v0.5.7)
- **버그: 🎲 추출 시 "모두 배치 완료" 가 409 에러로 표시** — 정상 종료 케이스를 error 응답으로 처리해 사용자에게 빨간 alert. → API 가 200 + `{ done: true, remainingCount: 0, userId: null, displayName: null }` 반환, Activity 측은 done 플래그 보고 정상 안내 ("✅ 모두 배치 완료 — [▶ 토너먼트 진행] 클릭"). 🎲 버튼은 `allPlaced` 시 disabled.
- **버그: 4강 매치업 동시 진행 불가** — `MatchSetup` 컴포넌트가 `status === BRACKET_SETUP` 일 때만 노출. 첫 SEMI 매치 생성 시 자동으로 IN_GAME 으로 전환 → MatchSetup 사라짐 → 두 번째 SEMI 만들 수 없음. 실제 라이브 4강은 두 매치 병행 진행 가능해야 함. → 조건 확장: 20인 토너먼트에서 `semis.length < 2` 면 IN_GAME 상태에서도 MatchSetup 노출. 두 매치 다 만든 후에야 사라짐.

### Phase 23 — 경매 토너먼트 변환 핫픽스 (v0.5.6)
- **버그: `POST /api/auction-tournaments` 가 `status === 'OPEN'` 만 허용** — 봇 [▶ 경매 시작] 으로 CLOSED 된 모집은 변환 차단 → "409: status=CLOSED — 변환 불가". 정상 사용자 흐름이 막힘.
- **fix**: OPEN 또는 CLOSED 둘 다 허용. 또 이미 `converted_tournament_id` 가 있으면 동일 id 반환 (멱등) — 재변환 시 충돌 없음.
- **사용자 흐름 정상화**: `/경매내전모집` (OPEN) → 정원 채움 → 봇 [▶ 경매 시작] (CLOSED) → Activity 진입 → 카드 클릭 → AuctionDraft 의 [▶ 경매 시작] (CONVERTED) → CAPTAIN_PICK.

### Phase 22 — 경매 Activity 노출 핫픽스 (v0.5.5)
- **버그 1: AuctionDraft 의 React Hook 규칙 위반** — `if (!s.detail) return ...` 의 early return 아래에 `useEffect(onEnterBracket)` 가 있어 첫 렌더 vs 후속 렌더의 hook 호출 개수 불일치 → invariant violation, 컴포넌트 crash. ErrorBoundary fallback 으로 표시되거나 흰 화면. → useEffect 를 early return 전으로 이동, `status` 대신 `tournamentStatus = s.detail?.tournament.status` 사용 (undefined safe).
- **버그 2: `/api/auction-recruitments` 가 OPEN 만 반환** — 일반 모집은 CLOSED 모집만 (엔트리 대기 상태) Activity 에 노출되는데, 경매는 OPEN 만 반환해 [▶ 경매 시작] 클릭 후 CLOSED 가 되면 Activity 대시보드에서 사라짐 — Activity 진입 경로 자체 차단. → `db.listActiveAuctionRecruitments` 신규 helper (OPEN + CLOSED + CONVERTED) + API 가 호출.
- 두 버그가 합쳐져 사용자가 경매 모집을 만들고 [▶ 경매 시작] 클릭해도 Activity 에 카드 자체가 안 보이거나 (버그 2), 카드 클릭해도 화면이 crash 됨 (버그 1).

### Phase 21 — `/랜덤인원추가` 테스트 도구 (v0.5.4)
- **신규 슬래시 `/랜덤인원추가 모집:N 인원:M`** — 운영자 전용 테스트 도구. 등록된 사용자 (`users` 테이블) 풀에서 랜덤 M명을 모집 #N 에 추가. 일반 (`recruitments`) / 경매 (`auction_recruitments`) 모집 자동 감지.
- **dummy 안 만듦** — 실제 등록된 사용자만 사용. 검색 / 리더보드 / 프로필에 추가 노출 없음 (이미 활동 중인 사용자). 사후 cleanup 은 운영자 책임.
- **자동 제외** — 운영자 본인, 이미 모집에 참가한 사용자, `discord_id LIKE 'test-%'` (혹시 모를 dummy). `ORDER BY RANDOM()` 으로 매번 다른 사용자.
- **정원 가드** — 요청 인원 > 남은 자리면 남은 자리만큼만. 풀 부족 시 가능한 만큼 + 경고. 정원 가득 시 거부.
- **모집 메시지 자동 갱신** — `refreshRecruitMessage` / `refreshAuctionRecruitMessage` 호출. 정원 도달 시 봇 채널 메시지에 [▶ 엔트리 수정 / 경매 시작] 버튼 자연 노출 — 운영자가 일반 흐름 그대로 진행.
- **Audit** — `recruitment.random-bulk-add` / `auction-recruitment.random-bulk-add` action 으로 기록. `/로그` 에서 추적.
- **사후 cleanup 가이드** — 응답 ephemeral 에 명시: `/시리즈강제삭제 series_id:N rollback_mmr:true` 로 영향 받은 사용자의 `user_lane_mmr` 정확 복원 (기존 `inspectSeriesForDelete` + `forceDeleteSeriesWithRollback` 패턴, v0.2.x 부터).
- **사용 흐름**: `/내전모집` 또는 `/경매내전모집` → 운영자 [참석] → `/랜덤인원추가 인원:9` → 정원 도달 → 일반 흐름 → 종료 → `/시리즈강제삭제` → MMR 정확 복원.

### Phase 20 — 봇 버튼 핸들러 token expire 방어 (v0.5.3)
- **DiscordAPIError 10062 fix** — `recruit:cancel:48` 같은 버튼 클릭이 D1 fetch (`getRecruitment`) 가 3초 ack 윈도우를 초과해 interaction token 만료 후 `reply` 시도하던 long-standing 버그.
- **`handleButton` 즉시 deferUpdate** — customId 파싱 + id 검증 직후 (모든 D1 fetch 전) `try { await interaction.deferUpdate(); } catch {}` 로 ack 확보. 후속 fetch 가 지연돼도 token 살아있음.
- **`reply` → `notify(interaction, content)` 헬퍼** — defer 상태에 따라 `followUp` (ephemeral) 또는 `reply` 분기, 전부 try/catch 로 silent skip (expire 됐어도 server-side 로직은 일관성 유지).
- **`recruit/` + `auctionRecruit/` 두 핸들러 동시 적용** — 같은 구조 잠재 위험 있어 사전 fix. 기존 동작 변경 없음 (사용자 facing 동일, 안정성만 ↑).
- **운영 영향**: 모집 cancel / next / join / leave 버튼이 D1 cold start / network jitter 로 3초 초과해도 silent 동작 — "버튼 눌렀는데 응답 없음" 사용자 체감 사례 감소.

### Phase 19 — Activity 버전 표시 (v0.5.2)
- **monkey 로고 옆 버전 표시** — `<span>v0.5.2</span>` 작게 inline. 사용자가 현재 Activity 가 어떤 버전인지 즉시 확인 가능 (배포 회귀 시 디버깅 도움).
- **Vite define 으로 빌드 시점 주입** — `vite.config.ts` 가 root `package.json` 의 version 을 읽어 `__APP_VERSION__` 전역 상수로 inline. release 마다 자동 갱신, runtime fetch X.
- **TypeScript 타입** — `apps/activity/src/vite-env.d.ts` 에 `declare const __APP_VERSION__: string` 추가.

### Phase 18 — 경매내전 UX 보강 + 후속 (v0.5.1)
- **BAN 입력 UI** — AuctionBracket 의 GameInputForm 에 각 팀 5밴 슬롯 추가. 기존엔 `bans: []` 하드코딩이었음.
- **챔프 그리드 모달** — 신규 `ChampPickerModal` (검색 + 8x N 그리드, PickBan 의 `ChampCell` 재사용). 픽/밴 슬롯 클릭 시 모달 열림, 이미 선택된 챔프는 비활성. 기존 단순 `<select>` 대체.
- **직전 게임 되돌리기 UI** — AuctionBracket 의 매치 카드에 `↺ 직전 게임` 버튼 (ConfirmButton, 게임 ≥1 일 때만 노출).
- **BO1/BO3 변경 UI** — 매치 카드에 `↔ BO1/BO3 변경` 토글 (게임 0개일 때만).
- **토너먼트 강제 취소** — AuctionBracket 헤더에 `⛔ 토너먼트 강제 취소` (ConfirmButton, COMPLETED 제외 모든 상태에서 운영자만).
- **낙찰 취소 confirm** — AuctionDraft 의 BiddingPanel 에서 ✕ 클릭 → ConfirmButton 으로 2-step 확인 (실수 방지).
- **AuctionResult 매치 디테일** — 매치별 게임 collapse: 라인별 픽 챔프 + 1팀 사이드 + BAN. SeriesResult 와 통일성 향상.
- **`/시리즈목록` AUCTION 표시** (Q16) — 슬래시 응답에 `🎟️ 경매` 뱃지 노출. `SeriesRow.type` 필드 type 추가.
- **`/내정보갱신` 슬래시** (🥈 백로그 처리) — 본인 라이엇 계정의 소환사 아이콘을 Summoner-V4 로 재 fetch. 변경 / 변경 없음 / 실패 별로 상태 표시. League 안에서 아이콘 변경 시 즉시 반영 경로.

### Phase 17 — 경매내전 (이벤트성 드래프트) (v0.5.0)
- **신규 모드** — `/경매내전모집 정원:10/20` 으로 시작하는 이벤트성 드래프트. 일반 내전과 완전 분리된 lifecycle, MMR 영향 0 (이벤트성), 챔프 픽/밴 / 승패 전적은 일반 통계와 통합. 기획서: [`AUCTION_PLAN.md`](./AUCTION_PLAN.md).
- **DB schema (A)** — `series` ALTER (`type='RANKED'|'AUCTION'` + `auction_tournament_id` FK) + 7개 신규 테이블 (`auction_recruitments`, `auction_recruitment_participants`, `auction_tournaments`, `auction_teams`, `auction_team_members`, `auction_bids`, `auction_matches`). 기존 series 자동 `type='RANKED'` 채움 — MMR 흐름 영향 0.
- **MMR 격리** — `recordGameAndUpdateMmr` ↔ `recordGameOnly` 분기. AUCTION 매치는 후자만 호출 (mmr_changes / user_lane_mmr 안 건드림). 통합 테스트 2건 보장.
- **api 라우트 (B)** — 19개 신규 endpoint: `/api/auction-recruitments/*`, `/api/auction-tournaments/*` (CAPTAIN_PICK → POINT_ALLOC → BIDDING → PLACEMENT → BRACKET_SETUP → IN_GAME → COMPLETED), `/api/auction-matches/*` (게임 결과 — `recordGameOnly` 호출). 운영자 권한 가드 + WS broadcast (`auction-tournament:N`, `auction-recruitment:N`, `auction-dashboard`).
- **봇 슬래시 (C)** — 4종 신규: `/경매내전모집`, `/경매내전모집인원추가`, `/경매내전모집인원삭제`, `/경매내전강제삭제`. V2 채널 메시지 (🎟️ 라벨), 정원 도달 시 `[▶ 경매 시작]` 버튼.
- **Activity 화면 (D-F)** — 신규 stage 3개 (`AUCTION_DRAFT` / `AUCTION_BRACKET` / `AUCTION_RESULT`) + 컴포넌트 4개 (`AuctionDraft` / `AuctionBracket` / `AuctionResult` + `useAuctionState` hook). 운영자 수동 컨트롤 (Q3 4강 매치업 / Q4 입찰 동률 / Q8 라인 자유 / Q14 팀장도 선수). 대시보드에서 경매 모집 별도 섹션.
- **종료 카드 (F)** — Bo3 시리즈 종료 카드 (v0.4.3) 패턴 그대로 — 토너먼트 COMPLETED 시 모집 채널에 우승 팀 + 매치 결과 V2 메시지 자동 발행 (edit-or-send 멱등).
- **통합 vs 격리** — `game_stats` / `game_picks` / `game_bans` 는 같은 테이블 (사용자 챔프 누적 / 라인별 W/L 자동 합산), `mmr_changes` / `user_lane_mmr` / `/랭킹` / 리더보드는 자동 격리 (auction 은 안 들어감).
- **prod D1 마이그레이션 적용 완료** — schema 갱신 + auction 테이블 7개 생성. 기존 series 데이터 모두 `type='RANKED'` 자동 채움. 사용자 facing 변동 0 (코드 배포 전까지).

### Phase 16 — navbar 모집↔시리즈 breadcrumbs (v0.4.5)
- **`ContextChip` → daisyUI breadcrumbs 교체** — 기존 단일 라벨 chip ("📋 모집 #5 · 엔트리 수정", "🎮 시리즈 #5 · 픽/밴") 을 다단 breadcrumbs (`📋 모집 #5  ›  🎮 시리즈 #5  ›  픽/밴`) 로 확장. v0.3.4 의 "모집 ID = 시리즈 ID" 1:1 매핑이 사용자에게 자연 노출 — 모집과 시리즈가 같은 #N 임을 시각으로 즉시 인지.
- **단계별 항목**:
  - `ENTRY_EDITING`: `📋 모집 #N` → `엔트리 수정` (시리즈 row 미생성 — 엔트리 제출 시점 INSERT)
  - `IN_GAME`: `📋 모집 #N` → `🎮 시리즈 #N` → `픽/밴`
  - `COMPLETED`: `📋 모집 #N` → `🎮 시리즈 #N` → `✅ 종료`
  - `PROFILE` / `LEADERBOARD` / `MINIGAME` / `MY_RIOT_ACCOUNTS`: 단일 항목 (페이지 이름)
- **시각 위계**: 마지막 항목은 `text-base-content` (active), 이전 항목들은 `text-base-content/55` (muted) — 현재 위치 즉시 식별.
- **clickable X (정적 표시)** — 대시보드 복귀 길은 좌측 monkey 로고가 담당, breadcrumbs 항목은 navigation 안 함. (필요 시 향후 추가 가능)
- **× 닫기 버튼 제거** — monkey 로고와 중복 동작이라 정리. UI 잡음 ↓.

### 메타 — 운영 / 워크플로우 (cross-cutting)
- **`.claude/settings.json` committed** — Claude Code 권한 prompt 감소 + release 자동화 allowlist (typecheck/test/build, gh, git, ssh, docker:release 등). destructive 명령은 deny 명시 (force push, hard reset, db:migrate:drop, wrangler d1 execute 등).
- **1인 개발 워크플로우 정착** — PR/리뷰 ceremony 제거, `main` 브랜치 직접 commit + push. release 흐름은 `commit → version:patch → push → docker:release → ssh`.
- **`pnpm deploy:vps` 자동화** (v0.3.25) — preflight + docker:release + ssh compose pull/up + health check 한 명령.

## 🚧 진행 중 / 부분 (Partial)

_(없음 — v0.4.3 의 시리즈 종료 카드로 마지막 partial 항목이 완료됨)_

## 📅 백로그 (Backlog)

> 마커 — 🥇 다음 우선 / 🥈 작은 가성비 (1~2h) / ⏸ 외부 블로커 / (무) 일반.

### UX
- 🥇 **밸런스-확인 Discord 채널 자동 업로드** — `sharp` 로 SVG → PNG 변환 + webhook URL. v0.4.0 의 SVG 엔드포인트가 미래 webhook 용으로 보존됨, 인프라 완비. 종료 카드 (v0.4.3) 와 같은 lifecycle 카테고리 — 모집 채널 알림 완성.
- **Activity 모집 컨트롤** — 봇 `/내전모집` 슬래시 의존 제거, Activity 안에서 모집 생성. 새 화면 + 채널 선택 UI + 권한, 6~10h.
- **픽밴 cursor presence** — 실시간 다인 협업 시각화 (WS protocol 확장).
- ⏸ **K/D/A · CS 자동 수집** — Riot production key 또는 tournament API 인증 후 활성화. DB 컬럼 (`game_stats.kills/deaths/assists/cs`) 과 `recordGame` 파라미터는 보존, UI 노출 X. 인증 받으면 `/지금게임` 매치 종료 hook 또는 tournament API callback 으로 자동.
- ⏸ **모바일 Activity QA** — iOS/Android 실기 검증 후 Developer Portal Mobile platform 활성화. (Phase 8 D 에서 반응형 navbar 추가했으나 실기 미검증.)

### 운영 / 관측성
- 🥈 **`/내정보 갱신` 슬래시 (소환사 아이콘 재fetch)** — 사용자가 League 안에서 아이콘 변경 시 즉시 반영. Summoner-V4 호출 1회. 0.5~1h.
- **audit_log retention 정책** — 정상 lifecycle audit (v0.3.26) 까지 누적되면 시즌 단위 archive 또는 90일 retention. 현재는 무제한 — 누적 부담 작아 긴급도 낮음.
- **pino info/warn 로그도 `/logs` 웹뷰에서 조회** — 현재 audit_log 만; 별도 events 테이블 또는 Cloudflare Logpush 필요.
- ⏸ **자동 시즌 전환 (스케줄러)** — 시즌 컷오프 정책 미결.

### 인프라
- **봇 명령 스모크 테스트** — 인터랙션 mocking 복잡도 vs 가치 trade-off, 미정.
- **vite 8 마이그레이션** (Wave 6.4 보류분, 현재 v7.3 으로 운영 안정 — 긴급도 0).

## 🎯 결정 / 비목표 (Non-goals)

- **EntryEditing 자동 배치 / 추천 매칭은 의도적 비목표** — 운영자(BalanceTeam) 수동 밸런싱이 도메인 핵심 가치
- **PNG 카드 렌더링 X** — v1 의 satori → resvg 흐름은 v2 에서 완전 폐기 (Components V2 + Activity SPA + 인라인 SVG 로 대체)
- **봇 슬래시는 read-only + 운영 명령어 한정** — write 인터랙션은 Activity 가 책임
- **시리즈 hard-delete 는 admin 응급용** — 일반 흐름은 모두 soft-delete (`deleted_at`). 진짜 물리 삭제가 필요하면 `purgeSeries(id)` 별도 호출
- **챔프 splash art 를 사용자 아바타로 사용 X** (v0.3.20 결정) — League 소환사 아이콘 (`profile_icon_id`) 이 사용자 신원의 표준. 챔프 데이터는 `splashUrl`/`iconUrl` 필드로 응답에 포함되지만 fallback 으로만.
- **PR + 리뷰 흐름 X** (v0.3.x 후반 결정) — 1인 개발 프로젝트. `main` 직접 commit + push, release 도 동일 흐름.

## 운영 메모

- **릴리스**: `pnpm version:patch && pnpm docker:release` → VPS `docker compose pull && up -d` (manual; auto-watch 없음). PR 흐름 X — `main` 직접. (전체 자동화: `pnpm deploy:vps`)
- **D1 백업**: wrangler export 가 일시적으로 D1 unavailable → 03:00 KST 트래픽 0 가정 위에서만 안전.
- **D1 schema 변경 시**: `pnpm --filter @mookbot/core db:migrate` (idempotent, ALTER ADD COLUMN 도 멱등 흡수). prod 배포 전에 먼저 마이그레이션 권장.
- **nginx 새 api 라우트**: `/api/*` prefix 로 등록해야 외부 노출.
- **컨테이너 healthcheck**: `wget localhost` 는 IPv6 `::1` 해석 → `127.0.0.1` 명시.
- **새 슬래시 도입 시**: `pnpm --filter @mookbot/bot exec tsx src/deploy-commands.ts` 로 재등록.
- **새 환경변수 추가 시**: `apps/{api,bot}/src/env.ts` zod schema + `.env.example` + VPS `/root/deploy/{api,bot}/.env` 3곳 동기화.
- **`LOGS_JWT_SECRET`**: 봇/api 동일 값 (HS256 서명/검증). 회전 시 두 컨테이너 동시 재시작.
- **신규 사용자 라이엇 ID 등록**: Summoner-V4 자동 호출 — `RIOT_API_KEY` 만료 시 등록은 진행되지만 `profile_icon_id` NULL 상태 (백필로 채움).
