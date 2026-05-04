# Roadmap

> 현재 버전 기준 진척 상태. 시간순 기획서는 [`PLAN.md`](./PLAN.md), 코드 리뷰 워킹노트는 [`docs/internal/`](./docs/internal/) 참조.

## 현재 (v0.3.5)

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
- 모두 BalanceTeam role 게이트 (`apps/api/src/auth/perms.ts`)

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

## 🚧 진행 중 / 부분 (Partial)

- **Wave 3.x 추가 리팩토링** (우선순위 낮음): `usePickBanState` / `useEntryEditingState` 훅 추출 여지
- **Phase 5 백로그 항목**: 시리즈 종료 알림 (3게임 픽밴 마크다운 표) 텍스트 스켈레톤만 있음

## 📅 백로그 (Backlog)

### UX
- "밸런스-확인" Discord 채널 자동 업로드 — `sharp` 로 SVG → PNG 변환 + webhook URL. 현재는 운영자가 Activity 의 "URL 복사" / "새 탭 열기" 로 수동 공유.
- Activity navbar — `모집 #N → 시리즈 #N` 매핑 시각화 (현재 단일 badge 만 표시).
- 모바일 Activity QA — iOS/Android 검증 후 Developer Portal Mobile platform 활성화 결정.
- 픽밴 cursor presence (실시간 다인 협업 시각화).

### 운영 / 관측성
- audit log 커버리지 확장 — `series.created` / `recruitment.*` / `game.recorded` / `game.undone` 등 비-삭제 이벤트도 기록 (현재는 운영자 destructive action 만).
- pino info/warn 로그도 `/logs` 웹뷰에서 조회 (현재 audit_log 만; 별도 events 테이블 또는 Cloudflare Logpush 필요).
- 자동 시즌 전환 (스케줄러).

### 인프라
- 봇 명령 스모크 테스트 (인터랙션 mocking 복잡도 vs 가치 trade-off — 미정).
- vite 8 마이그레이션 (Wave 6.4 보류분).

## 🎯 결정 / 비목표 (Non-goals)

- **EntryEditing 자동 배치 / 추천 매칭은 의도적 비목표** — 운영자(BalanceTeam) 수동 밸런싱이 도메인 핵심 가치
- **PNG 카드 렌더링 X** — v1 의 satori → resvg 흐름은 v2 에서 완전 폐기 (Components V2 + Activity SPA + 인라인 SVG 로 대체)
- **봇 슬래시는 read-only + 운영 명령어 한정** — write 인터랙션은 Activity 가 책임
- **시리즈 hard-delete 는 admin 응급용** — 일반 흐름은 모두 soft-delete (`deleted_at`). 진짜 물리 삭제가 필요하면 `purgeSeries(id)` 별도 호출

## 운영 메모

- 릴리스: `pnpm version:patch && pnpm docker:release` → VPS `docker compose pull && up -d` (manual; auto-watch 없음)
- D1 백업 시 wrangler export 가 일시적으로 D1 unavailable → 03:00 KST 트래픽 0 가정 위에서만 안전
- nginx 새 api 라우트는 `/api/*` prefix 로 등록해야 외부 노출
- 컨테이너 healthcheck 의 `wget localhost` 는 IPv6 `::1` 해석 → `127.0.0.1` 명시
- 새 슬래시 도입 시 `pnpm --filter @mookbot/bot exec tsx src/deploy-commands.ts` 로 재등록
- 새 환경변수 추가 시 `apps/{api,bot}/src/env.ts` zod schema + `.env.example` + VPS `/root/deploy/{api,bot}/.env` 3곳 동기화
- 봇/api 에서 `LOGS_JWT_SECRET` 은 반드시 동일 값 (HS256 서명/검증). 회전 시 두 컨테이너 동시 재시작.
