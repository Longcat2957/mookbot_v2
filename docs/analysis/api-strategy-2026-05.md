# API 업그레이드 전략 메모 (v0.11.x 시야)

> 작성: 2026-05-13 · 대상: `apps/api/**` + `packages/core/src/{logger*,db}` 직결 영역
> 비범위: Activity UI · 봇 슬래시 기능 · 신규 도메인 라우트 · 멀티 길드
> 자매 문서: `docs/plans/api-near-term.md` (실행 단위 task plan). 이 문서는 **그 위 레벨의 의사결정 메모**.

---

## TL;DR

다음 1~2 릴리스의 API 작업은 세 가지 축으로 좁힌다.

1. **관측성 + retention** — "운영 시 무슨 일이 일어나는지 30초 안에 본다" 를 완성.
2. **CI 신뢰도 + 경매 도메인 회귀 가드** — 실서비스에서 가장 어두운 사각지대를 메운다.
3. **요청/응답 계약 (typed routes) pilot** — 16+ 도메인이 늘어나기 전에 비용이 작은 시점에 표준 진입.

1·2 는 v0.11.0~v0.11.3 에 끝낸다. 3 은 같은 윈도우에 **pilot 만** 깔고 본 마이그레이션은 v0.12 로 미룬다.

---

## 테마 1 — 관측성 + 보존정책 (v0.11.0~v0.11.2)

### 왜 중요한가
현재 `/api/healthz/deep` 는 `db: ok/fail` + `bot.heartbeat` 만 노출. D1 latency, 에러 webhook transport (token bucket / dedupe) 상태, 현재 배포 버전, 모두 가려져 있다. 운영 이벤트 (pino warn/error) 도 `/api/logs` 웹뷰에 안 들어가서, 실제로 문제 추적은 SSH+`docker logs` 로 떨어진다. `admin_audit_log` 는 누적 무제한.

→ **운영자의 1차 진단 surface** 를 외부 모니터링이 직접 잡을 수 있는 형태로 끌어올린다.

### 중심 파일
- `apps/api/src/http/healthz.ts` — `pingD1` 에 latency 측정, `DeepResponse` 확장 (`dbLatencyMs`, `version`, `errorWebhook` 통계).
- `packages/core/src/logger-discord-transport.ts` — `getTransportStats()` export 신설 (dropped / queued / lastSentAt).
- `packages/core/src/db/admin.ts` — `pruneAuditLog(beforeUnixSec)` + `recordSystemEvent(...)` + `listAuditLog(actionPrefix?)`.
- `apps/api/src/http/_errors.ts` — unhandled 500 핸들러에서 fire-and-forget `recordSystemEvent("error.unhandled", ...)`.
- `apps/api/src/http/logs.ts` — `action_prefix=system.` 필터 + retention 90일 안내 텍스트.
- `.github/workflows/audit-retention.yml` (신규) — 04:00 KST 일 1회 prune (백업 직후).

### 의견
- 시즌 단위 archive 는 **하지 마라**. 시즌 컷오프 정책이 아직 미결이라 의존성이 거꾸로 흐른다. 90일 시간 기반 + D1 백업이 historical record. 시즌 결정 나면 그때 archive.
- Cloudflare Logpush 채택은 **이번 윈도우엔 비추**. "쓸 만한 운영 신호 10~20종" 을 명시적 audit 화 하는 절충이 1인 운영 규모에 맞다. Logpush 는 비용+destination 추가, 본 시점에서는 over-engineering.
- 에러 webhook transport stats 노출은 **하라**. dedupe / token bucket 카운터가 까맣게 가려져 있어 "왜 webhook 이 안 왔지" 추적 비용이 매번 똑같이 든다.

---

## 테마 2 — CI 빌드 검증 + 경매 도메인 회귀 가드 (v0.11.0~v0.11.3)

### 왜 중요한가
두 사각지대가 겹친다.

(a) CI 가 `pnpm build` 를 안 돌린다 (`.github/workflows/ci.yml` 은 typecheck + biome + vitest). `apps/api/dist/` 가 실제로 import 해결되는지를 main 머지 후 `docker:release` 단계에서 처음 안다. tsc 가 통과하는데 ESM resolution 이 깨지는 회귀 패턴은 1인 운영에서 가장 비싼 종류의 버그다.

(b) `apps/api/src/http/auction-{tournament,recruit,match}.ts` 의 통합 테스트가 0건이다. `auction-tournament.ts` 만 540줄, CAPTAIN_PICK → POINT_ALLOC → BIDDING → PLACEMENT → BRACKET_SETUP → IN_GAME → COMPLETED 로 7-state 전이 + 입찰/유찰/매물/매치/결과 endpoint 다수. 다른 도메인 (`series.ts`, `me-riot-accounts.ts`, `logs.ts`) 은 옆에 `.test.ts` 가 있는데 **가장 복잡한 도메인에만 없다**. v0.9.0~v0.10.2 에서 경매 기능이 가장 활발히 변경되고 있어 회귀 노출이 크다.

### 중심 파일
- `.github/workflows/ci.yml` — Typecheck 뒤에 `Build (all packages)` step (`pnpm build`) 추가. `pnpm audit --prod` 는 `continue-on-error` 로 정보용만.
- `.github/workflows/d1-backup.yml` — `gzip -t` + 라인 수 summary 출력.
- `apps/api/src/http/auction-tournament.ts` (540) · `auction-recruit.ts` (150) · `auction-match.ts` (325) — **각각 통합 테스트 신설**. 우선순위는 (1) tournament 의 state 전이 가드 (잘못된 status 에서 호출 시 409 반환), (2) `softDeleteAuctionTournament` 의 종속 시리즈 cleanup (v0.10.1 fix 회귀 방지), (3) bidding 멱등성.
- `apps/api/src/http/db-routes.test.ts` 패턴을 참조 (이미 잘 짜여있음).

### 의견
- 경매 테스트는 **happy path 1개 + 모든 state 전이 guard 1개씩** 만. coverage 목적 아니라 회귀 가드.
- CI build 추가로 PR latency 가 +1~2분 늘지만 1인 개발이라 충분히 허용. 머지 후 24시간 뒤 production rollback 비용보다 훨씬 작다.

---

## 테마 3 — Typed routes pilot (v0.11.x 깔고, 본 마이그레이션은 v0.12+)

### 왜 중요한가
현재 라우트는 모두 ad-hoc 검증을 한다. 예: `series.ts:24`
```ts
if (!recruitmentId || !Array.isArray(assignments)) {
  return reply.code(400).send({ error: "recruitmentId / assignments required" });
}
if (team1Side !== undefined && team1Side !== "BLUE" && team1Side !== "RED") { ... }
```
`Number(req.params.id)` + `Number.isFinite` 패턴은 16개 도메인 어디나 반복. `users.ts`(460), `auction-tournament.ts`(540) 등 대형 파일에서 누락/불일치 위험이 자연 증가. 동시에 응답 shape 도 비형식적 (`{ seriesId: number }` vs `{ ok: true }` vs `{ series: [...], total: N }` 패턴이 도메인마다 다름).

zod 는 이미 `apps/api/src/env.ts` 와 `packages/core` 에서 사용 중. `@fastify/type-provider-zod` (또는 자체 thin helper) 도입은 의존성 추가 0~1, 점진적 채택 가능. 지금 안 깔면 **도메인이 더 커지면 갈수록 비용이 선형 증가**.

### 중심 파일 (pilot 범위)
- `apps/api/src/http/_helpers.ts` — `defineRoute(...)` 또는 `app.withTypeProvider(...)` 헬퍼.
- `apps/api/src/http/healthz.ts` — 응답 schema 가 가장 작아 첫 후보.
- `apps/api/src/http/logs.ts` (data 핸들러) — 쿼리스트링 정형화 효과 큼.
- 1~2개 pilot 만. 다른 도메인은 건드리지 않는다.

### 의견
- **v0.11 윈도우는 pilot 까지만**. 본 마이그레이션은 회귀 위험이 있고 시간을 빨아먹는다.
- pilot 의 성공 기준: (a) 라우트 한 곳에서 `Number()`/`typeof` 검증이 사라짐, (b) 응답 타입이 fastify schema 와 자동 일치, (c) 기존 `HttpError`/`_errors.ts` 흐름과 충돌 없음. 셋 다 만족하면 v0.12 에서 모든 도메인 일괄 변환.
- pilot 이 실패하면 — 자체 thin helper (`parseQuery(schema, req)` 같은 함수) 로 우회. 외부 의존성 강제 도입 X.

---

## 우선순위 + 미루는 것

### 시간순
| 릴리스 | 내용 | 출처 |
| --- | --- | --- |
| v0.11.0 | 테마 1 (Phase A+B: CI build, healthz 확장) | api-near-term Phase A+B |
| v0.11.1 | 테마 1 (Phase C: audit retention 90일) | api-near-term Phase C |
| v0.11.2 | 테마 1 (Phase D: pino system event 통합) + 테마 2 (경매 회귀 테스트) | 이 문서 ↑ |
| v0.11.3 | 테마 3 pilot + 잡정리 | 이 문서 ↑ |

### 보류 / 비목표 (의도적으로 안 함)
- **시즌 단위 archive** — 시즌 컷오프 정책 결정 전까지 보류.
- **Cloudflare Logpush** — 운영 신호의 명시적 audit 화로 충분한 단계.
- **OpenAPI / Swagger 문서 자동생성** — 테마 3 마이그레이션 완료 후에 다시 평가. 지금은 over-engineering.
- **K/D/A · CS 자동 수집** — Riot production key 외부 블로커 (API 작업 아님).
- **Activity 모집 컨트롤 API** — UI 후속 작업 동반 필요 (이 문서 범위 밖).
- **WS 메시지 schema 정형화** — `ws/server.ts` 가 단순 (`join`/`invalidate` 2 종) 해서 비용 대비 가치 낮다. 도메인 메시지 늘면 재평가.
- **`apps/api/src/http/users.ts` (460) / `auction-tournament.ts` (540) 분해** — 가독성 욕망에 끌리지만 행위 변경 0 인 리팩터는 회귀 위험만 산다. 분해는 새 기능 추가가 같이 들어올 때만.

---

## 한 줄 요약

> **운영 가시성 (테마 1) → 회귀 가드 (테마 2) → 미래 비용 절감 (테마 3 pilot).**
> 신규 도메인 라우트는 이 윈도우에 추가하지 않는다. 다음 윈도우에서 자유롭게 추가하려고 지금 발판을 까는 것.
