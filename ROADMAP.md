# Roadmap

> 현재 버전 기준 진척 상태. 시간순 기획서는 [`PLAN.md`](./PLAN.md), 코드 리뷰 워킹노트는 [`docs/internal/`](./docs/internal/) 참조.

## 현재 (v0.3.3)

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

### Phase 5 — Activity 신규 기능 (v0.3.0~0.3.3, 진행 중)
- 리더보드 + 유저 프로필 (v0.3.0)
- 사다리 픽밴 가로대 fade-in (v0.2.16)
- 미니게임 신규 (원판) + QA 수정 (v0.2.15)
- 신규 사용자 안내 카드 (v0.3.1)
- CI lint 회복 (v0.3.2)
- 사용자 노출 mookbot → monkey 리네임 (v0.3.3)

## 🚧 진행 중 / 부분 (Partial)

- **Wave 3.x 추가 리팩토링** (우선순위 낮음): `usePickBanState` / `useEntryEditingState` 훅 추출 여지
- **Phase 5 백로그 항목**: 시리즈 종료 알림 (3게임 픽밴 마크다운 표) 텍스트 스켈레톤만 있음

## 📅 백로그 (Backlog)

- 모바일 Activity QA — iOS/Android 검증 후 Developer Portal Mobile platform 활성화 결정
- 픽밴 cursor presence (실시간 다인 협업 시각화)
- 자동 시즌 전환 (스케줄러)
- 봇 명령 스모크 테스트 (인터랙션 mocking 복잡도 vs 가치 trade-off — 미정)
- vite 8 마이그레이션 (Wave 6.4 보류분)

## 🎯 결정 / 비목표 (Non-goals)

- **EntryEditing 자동 배치 / 추천 매칭은 의도적 비목표** — 운영자(BalanceTeam) 수동 밸런싱이 도메인 핵심 가치
- **PNG 카드 렌더링 X** — v1 의 satori → resvg 흐름은 v2 에서 완전 폐기 (Components V2 + Activity SPA 로 대체)
- **봇 슬래시는 read-only + 운영 명령어 한정** — write 인터랙션은 Activity 가 책임

## 운영 메모

- 릴리스: `pnpm version:patch && pnpm docker:release` → VPS `docker compose pull && up -d` (manual; auto-watch 없음)
- D1 백업 시 wrangler export 가 일시적으로 D1 unavailable → 03:00 KST 트래픽 0 가정 위에서만 안전
- nginx 새 api 라우트는 `/api/*` prefix 로 등록해야 외부 노출
- 컨테이너 healthcheck 의 `wget localhost` 는 IPv6 `::1` 해석 → `127.0.0.1` 명시
