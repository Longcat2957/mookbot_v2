# Roadmap

> 현재 버전 기준 진척 상태. 시간순 기획서는 [`PLAN.md`](./PLAN.md), 코드 리뷰 워킹노트는 [`docs/internal/`](./docs/internal/) 참조.

## 현재 (v0.3.23)

활성 도메인: `bot.mooklol.com` (Cloudflare proxied → 단일 VPS · Docker compose 4컨테이너 stack: bot · api · activity · nginx).
실서비스 운영 중.

## ✅ 완료 (Shipped)

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

### Phase Q — 코드 품질 Wave 1~6 (2026-04-30 ~ 2026-05-01)
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

### Phase K — 메타 / 운영 (이번 사이클)
- **`.claude/settings.json`** committed — Claude Code 권한 prompt 감소 + release 자동화 allowlist (typecheck/test/build, gh, git, ssh, docker:release 등). destructive 명령은 deny 명시 (force push, hard reset, db:migrate:drop, wrangler d1 execute 등).
- **1인 개발 워크플로우 정착** — PR/리뷰 ceremony 제거, `main` 브랜치 직접 commit + push. release 흐름은 commit → version:patch → push → docker:release → ssh.

### Phase L — 후속 핫픽스 (v0.3.21~0.3.23)
- **Sticky footer** (v0.3.21) — 루트 컨테이너 `flex flex-col` + `<main>` `flex-1` 추가. 콘텐츠 짧은 화면에서 footer 가 viewport 중간에 떠있던 문제 수정.
- **픽/밴 일괄 입력 "모두 적용" 누적 버그** (v0.3.22) — `BulkInput.applyAll()` 이 4영역마다 `onApply` 4회 연속 호출 → 각 호출이 같은 `gameDraft` prop 기반 새 객체 생성 → 부모 `setDraft((prev) => ...)` 가 동일 prev 에 4번 덮어쓰기 → 마지막 (`TEAM_2 ban`) 만 반영되던 버그. `onApply` 시그니처를 다중 변경 array 로 변경, `handleApplyBulk` 가 같은 `next` 위에 누적 후 단일 `onChange()` 호출하도록 수정.
- **운영자 권한 = `BalanceTeam` 역할 단일화** (v0.3.23) — 기존 `OPERATOR_ROLE_ID`/`OPERATOR_ROLE_NAME` dual-path + "env 미설정 시 모두 허용" fallback 제거. 코드 기본값 `"BalanceTeam"` (env 로 override 가능). 길드에서 역할 미발견 시 fail-secure deny. `apps/api/src/auth/perms.ts` + `apps/bot/src/utils/operator.ts` 동시 적용. 테스트는 globalThis Symbol 기반 `__setCanEditOverrideForTest` 훅으로 vi.mock 없이 분기. **실제 영향**: v0.3.23 전까진 `bot/.env` 의 OPERATOR 설정이 비어있어서 (api 만 ID 설정) 봇 슬래시 운영자 명령은 누구나 실행 가능 상태였음 — 이번 릴리즈로 양쪽 모두 BalanceTeam 보유자만 통과. VPS env (`/root/deploy/{api,bot}/.env`) 도 정리 — `OPERATOR_ROLE_ID` 제거, `OPERATOR_ROLE_NAME=BalanceTeam` 명시.

## 🚧 진행 중 / 부분 (Partial)

- **Wave 3.x 추가 리팩토링** (우선순위 낮음): `usePickBanState` / `useEntryEditingState` 훅 추출 여지
- **Phase 5 백로그 항목**: 시리즈 종료 알림 (3게임 픽밴 마크다운 표) 텍스트 스켈레톤만 있음

## 📅 백로그 (Backlog)

### UX
- "밸런스-확인" Discord 채널 자동 업로드 — `sharp` 로 SVG → PNG 변환 + webhook URL. 현재는 운영자가 Activity 의 "URL 복사" / "새 탭 열기" 로 수동 공유.
- Activity navbar — `모집 #N → 시리즈 #N` 매핑 시각화 (현재 단일 ContextChip; breadcrumbs 변형으로 위계 강화 여지).
- 모바일 Activity QA — iOS/Android 검증 후 Developer Portal Mobile platform 활성화 결정. (Phase D 에서 모바일 검색 토글 + 반응형 navbar 추가했으나 실기 검증 필요)
- 픽밴 cursor presence (실시간 다인 협업 시각화).
- Activity 모집 컨트롤 — 현재 봇 `/내전모집` 슬래시만, 사용자 명시 보류 (v0.3.6 시점). 필요 시 별도 phase.

### 운영 / 관측성
- audit log 커버리지 확장 — `series.created` / `recruitment.*` / `game.recorded` / `game.undone` 등 비-삭제 이벤트도 기록 (현재는 운영자 destructive action 만).
- pino info/warn 로그도 `/logs` 웹뷰에서 조회 (현재 audit_log 만; 별도 events 테이블 또는 Cloudflare Logpush 필요).
- 자동 시즌 전환 (스케줄러).
- 소환사 아이콘 주기 갱신 — 사용자가 League 안에서 아이콘 변경 시 즉시 반영 X (등록 시점 / 백필 시점 캐시). 주기 cron 또는 `/내정보 갱신` 슬래시로 수동.

### 인프라
- 봇 명령 스모크 테스트 (인터랙션 mocking 복잡도 vs 가치 trade-off — 미정).
- vite 8 마이그레이션 (Wave 6.4 보류분).

## 🎯 결정 / 비목표 (Non-goals)

- **EntryEditing 자동 배치 / 추천 매칭은 의도적 비목표** — 운영자(BalanceTeam) 수동 밸런싱이 도메인 핵심 가치
- **PNG 카드 렌더링 X** — v1 의 satori → resvg 흐름은 v2 에서 완전 폐기 (Components V2 + Activity SPA + 인라인 SVG 로 대체)
- **봇 슬래시는 read-only + 운영 명령어 한정** — write 인터랙션은 Activity 가 책임
- **시리즈 hard-delete 는 admin 응급용** — 일반 흐름은 모두 soft-delete (`deleted_at`). 진짜 물리 삭제가 필요하면 `purgeSeries(id)` 별도 호출
- **챔프 splash art 를 사용자 아바타로 사용 X** (v0.3.20 결정) — League 소환사 아이콘 (`profile_icon_id`) 이 사용자 신원의 표준. 챔프 데이터는 `splashUrl`/`iconUrl` 필드로 응답에 포함되지만 fallback 으로만.
- **PR + 리뷰 흐름 X** (v0.3.x 후반 결정) — 1인 개발 프로젝트. `main` 직접 commit + push, release 도 동일 흐름.

## 운영 메모

- 릴리스: `pnpm version:patch && pnpm docker:release` → VPS `docker compose pull && up -d` (manual; auto-watch 없음). PR 흐름 X — `main` 직접.
- D1 백업 시 wrangler export 가 일시적으로 D1 unavailable → 03:00 KST 트래픽 0 가정 위에서만 안전
- D1 schema 변경 시 — `pnpm --filter @mookbot/core db:migrate` (idempotent, ALTER ADD COLUMN 도 멱등 흡수). prod 배포 전에 먼저 마이그레이션 권장
- nginx 새 api 라우트는 `/api/*` prefix 로 등록해야 외부 노출
- 컨테이너 healthcheck 의 `wget localhost` 는 IPv6 `::1` 해석 → `127.0.0.1` 명시
- 새 슬래시 도입 시 `pnpm --filter @mookbot/bot exec tsx src/deploy-commands.ts` 로 재등록
- 새 환경변수 추가 시 `apps/{api,bot}/src/env.ts` zod schema + `.env.example` + VPS `/root/deploy/{api,bot}/.env` 3곳 동기화
- 봇/api 에서 `LOGS_JWT_SECRET` 은 반드시 동일 값 (HS256 서명/검증). 회전 시 두 컨테이너 동시 재시작.
- 신규 사용자가 라이엇 ID 등록 시 Summoner-V4 가 자동 호출됨 — `RIOT_API_KEY` 만료 시 등록 흐름은 진행되지만 `profile_icon_id` NULL 상태 (백필로 채움).
