# API 근거리 개선 (CI / 관측성 / 보존정책)

> 작성: 2026-05-13 · 대상 버전: v0.10.3 → v0.11.x
> 범위: `apps/api/**`, `packages/core/src/{db,logger*.ts}`, `.github/workflows/**`
> 비범위: Activity UI, 봇 슬래시 동작 변경, 신규 도메인 기능

---

## 1. 목표 (Goal)

ROADMAP 백로그 "운영 / 관측성" 섹션의 미해결 항목 + CI 워크플로우의 약한 부분을
근거리(1~3 릴리스) 안에 정리한다. 코드 행위는 거의 그대로 유지하되,

- **CI 신뢰도**: 빌드 산출물(`dist/`)이 실제로 동작 가능한지를 CI 가 검증.
- **관측성**: `/api/logs` 가 audit 만 보던 한계를 넘어 운영 이벤트(pino warn/error)도 조회 가능.
- **데이터 위생**: `admin_audit_log` 가 무제한 누적되지 않도록 retention/archive 경로 마련.
- **운영 디버깅**: 에러 webhook 의 token bucket / dedupe 상태와 D1 ping latency 를
  `/api/healthz/deep` 로 노출 (외부 모니터링이 잡을 수 있게).

비목표: 신규 도메인 라우트, 멀티 길드, K/D/A 자동 수집(Riot key 외부 블로커).

---

## 2. 현재 상태 스냅샷

- API: Fastify 5 · Node 22 · `apps/api/src/index.ts` 부트 (`validateEnv` → cookie → ws →
  routes → ws server → datadragon init).
- 라우트 등록: `apps/api/src/http/routes.ts` — internal · healthz · auth · recruit ·
  series · games · champions · leaderboard · users · me-riot-accounts · logs ·
  balance-svg · auction-{recruit,tournament,match}.
- 글로벌 에러 핸들러: `apps/api/src/http/_errors.ts` (HttpError 401/4xx · validation 400 ·
  unhandled 500 + pino error). pino error 는 `packages/core/src/logger.ts` 에서
  Discord webhook 으로 forward (`ERROR_WEBHOOK_URL` 설정 시).
- 헬스: `GET /healthz` (얕음) + `GET /api/healthz/deep` (D1 ping + 봇 heartbeat age).
- 감사 로그: `packages/core/src/db/admin.ts` — `recordAudit` / `listAuditLog` /
  `listAuditActions`. `/api/logs` JWT-cookie 단일파일 HTML 뷰어
  (`apps/api/src/http/logs.ts`).
- CI: `.github/workflows/ci.yml` — typecheck + biome check + vitest. `pnpm build` 는
  미실행. D1 백업: `.github/workflows/d1-backup.yml` — 03:00 KST cron, retention-days 90.

ROADMAP 백로그 명시 사항:
- `audit_log retention 정책` — 시즌 단위 archive 또는 90일 retention.
- `pino info/warn 로그도 /logs 웹뷰에서 조회` — 현재 audit_log 만.

---

## 3. 아키텍처 / 결정 사항

### 3.1 retention 은 시간 기반 90일 + soft-cap

시즌 단위 archive 는 시즌 컷오프 정책이 미결(`⏸ 자동 시즌 전환` 백로그)이라
선행 의존성 발생. 단순 시간 기반 90일이 운영 부담 0 + 즉시 적용 가능.

- D1 에 별도 archive 테이블 두지 않는다. retention 초과 행은 `DELETE`.
- 진짜 historical 보존이 필요해지면 (i) 시즌 컷오프가 정해진 뒤 (ii) 시즌 기준 archive 로
  전환. 그때까지 D1 백업(.sql.gz) 이 사실상 historical record.
- 운영자 가시성을 위해 `listAuditLog` 가 최신순 → 90일 너머는 자연 가려짐, 영향 0.

### 3.2 pino 이벤트는 별도 테이블 (`api_events`) 대신 `admin_audit_log` 확장으로

ROADMAP 백로그는 "별도 events 테이블 또는 Cloudflare Logpush" 를 언급. Cloudflare
Logpush 는 외부 destination(R2/S3) 추가 비용. 별도 테이블은 schema 분기.

대신: 기존 `admin_audit_log` 의 `action` 네임스페이스에 `pino.warn` / `pino.error` 를
허용. operator_id 는 `system` 또는 호출 컨텍스트의 sid. 라우트 단에서 명시적으로
"이 경고는 운영자 가시성이 필요" 한 것만 기록 (전수 fanout 아님 — 시그널 노이즈
비율 보전). 기존 dedupe + token bucket 로직(`logger-discord-transport.ts`)과 별개 경로.

이 결정의 한계: 진짜 fire-and-forget 한 모든 pino info/warn 을 보고 싶다면 Logpush
가 정답. 본 plan 은 그 전 단계로, "쓸 만한 운영 신호 10~20종" 만 명시적 audit 화
하는 실용적 절충.

### 3.3 D1 ping 결과의 latency 노출

`/api/healthz/deep` 가 db.ok/fail 만 노출. 외부 모니터링(UptimeRobot 등)이 latency
spike 도 잡으려면 `dbLatencyMs` 필요. 추가 비용 0 (이미 측정 중).

### 3.4 CI: typecheck + lint + test 위에 `pnpm build` 추가

기존 CI 는 core 만 build, app build 미실행. tsc 의존성이 작은 `apps/api` 도 빌드해서
순환 import / 미해결 import 가 main 머지 후에 docker:release 단계에서 처음 드러나는
회귀를 사전 차단. `apps/bot` / `apps/activity` 도 같이 빌드(병렬).

---

## 4. 기술 스택

추가/변경 의존성 0. 모두 기존 스택만 사용.

- API: Fastify 5, pino 10, jose 6, zod 4.
- DB: Cloudflare D1 (`packages/core/src/cloudflare/d1.ts`).
- CI: GitHub Actions (Node 22, pnpm 10).
- 테스트: vitest 4 (`apps/api/src/http/*.test.ts` 기존 파일 옆에 추가).

---

## 5. 작업 (Tasks)

### Phase A — CI 워크플로우 정리 (가성비 큼, 동작 변경 0)

**A1. CI 에 빌드 검증 추가**
- 파일: `.github/workflows/ci.yml`
- 변경: `Typecheck` 단계 뒤에 `Build (all packages)` 단계 추가 — `pnpm build` 호출.
  기존 `pnpm --filter @mookbot/core build` 는 제거(상위 `pnpm build` 가 포함).
- 효과: api/bot/activity 의 tsc 에러를 CI 가 잡음.
- 검증: `gh run watch` 로 PR 빌드 확인.

**A2. D1 백업 무결성 검증**
- 파일: `.github/workflows/d1-backup.yml`
- 변경: `head -3 "$OUT"` 다음에 `gzip -t "${OUT}.gz"` (압축 무결성) + `wc -l "$OUT"`
  결과를 `>> $GITHUB_STEP_SUMMARY` 에 노출 (라인 수 급감 시 사후 점검 가능).
- 행위 변경 0, 부가 로그만 추가.

**A3. CI 에 `pnpm audit --prod` (정보용, 실패 허용)**
- 파일: `.github/workflows/ci.yml`
- 변경: `Test` 뒤에 `continue-on-error: true` 로 `pnpm audit --prod` 단계 추가.
  요약을 `$GITHUB_STEP_SUMMARY` 에 기록.
- 효과: 1인 개발 환경에서도 prod 의존성 CVE 누락 사전 인지.

### Phase B — `/api/healthz/deep` 강화

**B1. D1 latency 노출**
- 파일: `apps/api/src/http/healthz.ts`
- 변경:
  - `pingD1()` 이 `{ ok, latencyMs }` 또는 `{ ok: false, error, latencyMs }` 반환
    하도록 — `performance.now()` 측정.
  - `DeepResponse` 인터페이스에 `dbLatencyMs?: number`.
  - 응답 body 에 포함.
- 검증: `apps/api/src/http/healthz.test.ts` 신규 — D1 mock 으로 latency >0 확인.

**B2. 에러 webhook 상태 노출 (read-only)**
- 파일: `packages/core/src/logger-discord-transport.ts` (현재 내부 구현, 외부 export 없음)
  → 모듈 상단에 `getTransportStats(): { dropped: number; queued: number; lastSentAt: number | null }`
  export 추가. token bucket / dedupe 카운터 그대로 노출.
- 파일: `apps/api/src/http/healthz.ts`
  → `getTransportStats()` 가 import 가능하면 (`ERROR_WEBHOOK_URL` 설정 시) deep 응답에
    `errorWebhook: { dropped, queued, lastSentAt }` 추가.
- 행위 변경 0, 관측치만 노출.

### Phase C — Audit log retention 90일

**C1. core: retention 헬퍼**
- 파일: `packages/core/src/db/admin.ts`
- 추가: `pruneAuditLog(beforeUnixSec: number): Promise<{ deleted: number }>` — D1
  `DELETE FROM admin_audit_log WHERE created_at < ?`. D1 의 row 삭제 한도가 있다면
  분할(`LIMIT 1000` 루프). 기본은 단일 statement.
- 테스트: `packages/core/src/db/admin.test.ts` 에 케이스 추가 — 100개 INSERT,
  `pruneAuditLog(now - 90d)` 후 카운트 검증.

**C2. CI 워크플로우: 매일 prune**
- 파일: `.github/workflows/audit-retention.yml` 신규
- 내용: `cron: '0 19 * * *'` (04:00 KST, d1-backup 03:00 직후) · workflow_dispatch
  허용 · wrangler 로 D1 에 `DELETE FROM admin_audit_log WHERE created_at < strftime('%s','now','-90 days');`
  실행 · summary 에 affected 출력.
- 결정: TS 스크립트 경유 대신 wrangler 직접 SQL — d1-backup 워크플로우와 동일한
  패턴, 의존성 최소.
- 안전망: 90 → 환경변수 (`AUDIT_RETENTION_DAYS`) override 가능.

**C3. (옵션) `/api/logs` 헤더에 "최근 90일만 표시" 표기**
- 파일: `apps/api/src/http/logs.ts` (renderViewer)
- 변경: `<header>` 에 작은 `<small>retention 90일</small>` 텍스트 추가. 검색이
  empty 일 때 사용자 혼란 방지.
- 행위 영향 0.

### Phase D — pino 운영 이벤트의 `/api/logs` 통합

**D1. core: `recordSystemEvent` 헬퍼**
- 파일: `packages/core/src/db/admin.ts`
- 추가: `recordSystemEvent(action: string, payload?: object, note?: string)` —
  내부적으로 `recordAudit({ operatorId: "system", action: \`system.${action}\`, payload, note })`.
  네임스페이스 `system.*` 로 운영자 액션과 시각 분리.

**D2. API 핫스팟에 명시적 호출**
- 파일: `apps/api/src/http/_errors.ts`
  → unhandled 500 핸들러에서 `recordSystemEvent("error.unhandled", { url, method, message })`
    호출(fire-and-forget; await 안 함, 실패해도 500 응답엔 영향 0).
- 파일: `apps/api/src/auth/perms.ts:getRoles`
  → Discord API 5xx / rate limit 분기에서 `recordSystemEvent("perms.fetch_fail", { sid, status })`.
    Phase 11 의 long-standing 권한 캐시 오염 fix 가 다시 회귀하면 즉시 가시화.
- 파일: `apps/api/src/bot/notify.ts`
  → 봇 internal 호출 실패 시 `recordSystemEvent("bot.notify_fail", { route, status })`.
- 의도: 모든 warn 을 audit 화하지 않는다. 운영자가 "왜 X 가 안 됐지" 추적할 때
  쓸 만한 신호 ~5~10종만.

**D3. `/api/logs` 뷰어에서 system.* 필터 빠른 토글**
- 파일: `apps/api/src/http/logs.ts` (renderViewer + viewerScript)
- 변경: action select 위에 체크박스 `[ ] system.* 만` 추가. 체크 시 클라이언트에서
  `action=system.error.unhandled` 등 prefix 매칭 불가하므로 서버 측 변경 필요.
- 파일: `apps/api/src/http/logs.ts` (data 핸들러)
- 변경: querystring `action_prefix` 추가 → `listAuditLog` 에 `actionPrefix?: string`
  파라미터 추가 (`packages/core/src/db/admin.ts`) → SQL `action LIKE ? || '%'`.
- 테스트: `apps/api/src/http/logs.test.ts` 에 case 추가.

### Phase E — 기타 API-facing 백로그 정리 (작은 가성비)

**E1. `GET /api/healthz/deep` 응답에 `version` 추가**
- 파일: `apps/api/src/http/healthz.ts`
- 변경: `package.json` version 을 빌드 시 inline (현재 Activity 의 `__APP_VERSION__`
  vite define 과 동일 패턴 X — Node 측은 `fs.readFileSync(import.meta.resolve('../../package.json'))`
  대신 단순 `process.env.APP_VERSION` 으로 한정). Docker 빌드 단계에서 `APP_VERSION`
  주입(`scripts/docker-build.sh` 의 `--build-arg`).
- 효과: 외부 모니터링이 현재 VPS 가 어느 버전인지 검증 가능. release 회귀 시
  rollback 즉시 확인.

**E2. `/api/logs/data` 페이지네이션 안정성**
- 현재: `cursor = last row id`. `id` 가 UNIQUE 라 안전. 단 `limit=200` 초과 입력은
  `Math.min(200, ...)` 으로 차단됨 — 회귀 가능성 0, 변경 없음. (메모만)

**E3. `requireEditor` 에러 메시지의 i18n 분기 제거**
- 파일: `apps/api/src/http/_helpers.ts`
- 변경: 현재 한국어 메시지 그대로. 영문/한글 혼재 정리는 비목표 — 메모만.

**E4. zod env 의 `LOGS_JWT_SECRET` 가 optional 이지만 `/로그` 명령어가 503 의존**
- 파일: `apps/api/src/env.ts`
- 변경: optional 유지(VPS 가 실제 사용중이므로 fail-fast 로 강제하면 dev 환경 영향).
  대신 `apps/api/src/auth/logs-jwt.ts` 가 부트 시 1회 `log.warn` (`LOGS_JWT_SECRET
  미설정 — /로그 명령어 503`) 호출. 운영자가 누락 즉시 인지.

---

## 6. 릴리스 단위

- **v0.11.0** = Phase A + B (CI · 헬스체크 강화). 사용자 영향 0, 운영 영향만.
- **v0.11.1** = Phase C (audit retention 90일). DB 변경 0, 워크플로우 1개 추가.
- **v0.11.2** = Phase D (system event audit). API 행위 변경 미세 (감사 INSERT 추가).
- **v0.11.3** = Phase E (잡정리).

각 단계 끝에 `pnpm check && pnpm -r typecheck && pnpm test` 통과 + 변경 라우트의
통합 테스트 추가 + ROADMAP 갱신.

---

## 7. 검증 체크리스트

- [ ] `pnpm test` — 신규 테스트 포함 전체 통과.
- [ ] `pnpm exec biome check .` — clean.
- [ ] `pnpm build` — apps/api/dist/index.js 가 실제로 import 해결 (CI 단계 A1 이 검증).
- [ ] `curl https://bot.mooklol.com/api/healthz/deep` — `dbLatencyMs` / `errorWebhook` /
      `version` 필드 노출.
- [ ] `/로그` 슬래시 → 웹뷰 진입 → action select 에 `system.*` 항목 노출.
- [ ] 90일 retention 워크플로우 수동 dispatch → `admin_audit_log` 90일 너머 row 0.
- [ ] D1 백업 워크플로우 — `gzip -t` 통과 + summary 에 라인 수 노출.

---

## 8. 위험 / 비고

- **D1 DELETE 동시성**: retention prune 이 03:00 KST 백업 직후라 트래픽 0 가정.
  만약 한국시간 새벽 사용 증가 시 prune cron 을 백업과 분리하거나 시간 조정.
- **system event 폭주**: D2 의 호출 지점이 hot path(`getRoles`)라 Discord API 장애
  시 INSERT 폭증 가능. → `recordSystemEvent` 안에 in-process 1초 dedupe key
  (`action + payload-hash`) 추가 검토(Phase D 안에서). pino webhook transport 의
  dedupe 로직과 별개.
- **CI 빌드 추가로 PR latency ↑**: 현재 typecheck + lint + test ~3분 수준. build
  추가로 +1~2분 예상. 1인 개발이라 허용 범위.
- **Cloudflare Logpush 미선택**: 본 plan 의 system event audit 가 충분히 cover 못
  하는 (예: 모든 info/warn) 케이스가 나오면 그 시점에 Logpush 도입 — 본 plan 의
  D 단계는 폐기 또는 보완이 됨. 의도된 단계적 접근.

---

## 9. 다음 단계 (이 plan 밖)

- 시즌 컷오프 정책 결정 → audit_log 의 시즌 단위 archive 전환.
- `K/D/A · CS 자동 수집` — Riot production key 인증 후 (외부 블로커).
- Activity 모집 컨트롤(ROADMAP UX 백로그) — API 측 신규 `POST /api/recruitments`
  변형 + 권한 가드 + 채널 선택 UI 후속.
