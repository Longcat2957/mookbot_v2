# Full Code Review & Refactoring Plan

> **상태**: 2026-05-01 기획 시작. v0.2.7 기준.
> **목적**: 신규 기능 동결 구간에 코드 품질·구조·테스트를 끌어올린다. 동작 변경 0, 외부 인터페이스 변경 0.
> **종료 조건**: Wave 1~5 완료 + 측정 지표(아래 §7) 목표 도달.

---

## 0. 원칙

1. **동작 보존 (behavior-preserving)**. 모든 PR 은 사용자가 보는 결과·DB 스키마·API/WS 메시지 형태를 바꾸지 않는다. 변경이 필요하면 별도 기능 PR 로 분리.
2. **점진적 (incremental)**. Wave 단위로 끊어서 머지·운영 검증 가능한 크기 유지. 한 PR 당 ≤ 400 라인 변경 권장.
3. **타입체크/빌드 항상 green**. 어떤 PR 도 `pnpm -r typecheck` 깨면 안 됨.
4. **운영 영향 0**. 리팩터로 인해 컨테이너 재시작이 필요 없는 변경 우선. 필요하면 batch deploy.
5. **주석은 "왜"만**. 무엇(what)은 코드가 말하게. 비자명한 제약·과거 사고 회피·도메인 의도만 주석화.
6. **자동 분배 알고리즘 등 비목표 도메인은 손대지 않는다**. 운영자 수동 밸런싱이 핵심 가치 (memory: project_manual_balancing).

---

## 1. 현황 수치 (2026-05-01)

| 항목 | 값 |
|---|---|
| 총 TS/TSX LOC (src) | **11,712** |
| 파일 수 | 98 |
| Test 파일 수 | **0** |
| Lint/format 설정 | **없음** (biome/eslint/prettier 모두 X) |
| TODO/FIXME 주석 | **0** (잘 정리되어 있거나 이슈가 떠다님 — 확인 필요) |
| TypeScript strict | ✅ 모든 패키지: strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes |

**LOC by package**

| 패키지 | LOC | 파일 |
|---|---|---|
| `packages/core` | 3,562 | 38 |
| `apps/api` | 1,168 | 12 |
| `apps/bot` | 2,506 | 24 |
| `apps/activity` | 4,459 | 24 |

**큰 파일 (>300 LOC)** — 분해 1순위 후보

| 파일 | LOC | 비고 |
|---|---|---|
| `apps/activity/src/screens/PickBan.tsx` | **1,530** | 픽밴 단일 화면 — 슬롯/그리드/검색/사이드/되돌리기 모두 한 파일 |
| `apps/api/src/http/routes.ts` | **850** | 모든 REST 라우트 한 파일 (auth/series/picks/recruit/internal/healthz) |
| `apps/activity/src/screens/EntryEditing.tsx` | 826 | DnD 슬롯 보드 + 후보 풀 + 시리즈 INSERT |
| `apps/bot/src/commands/recruit.ts` | 664 | `/내전모집` — 메시지 생성/버튼/StringSelect/UserSelect 한 파일 |
| `apps/activity/src/screens/SeriesResult.tsx` | 373 | |
| `apps/activity/src/screens/RecruitmentList.tsx` | 350 | |
| `packages/core/src/db/record.ts` | 329 | |

---

## 2. 진단 — 관찰된 pain points

### 2.1 구조
- **God-component 화면**: PickBan (1530) / EntryEditing (826) — 한 컴포넌트에 상태/렌더/효과가 섞여있음. 서브컴포넌트 추출 + 도메인 훅 분리 여지 큼.
- **단일 라우트 파일** (`routes.ts` 850): 도메인별 (`series.ts`, `picks.ts`, `recruit.ts`, `auth.ts`, `internal.ts`, `healthz.ts` 신규) 분할 가능. healthz 만 이미 분리됨.
- **봇 명령 파일 패턴 일관성**: 12개 commands 중 11개 EmbedBuilder 사용 → 공통 helper 추출 가능 (이미 `utils/v2.ts` 존재 — 활용도 점검).
- **operator gate 중복**: api 와 bot 각각 별도 구현 (`apps/api/src/auth/perms.ts` ↔ `apps/bot/src/utils/operator.ts`). 핵심 정책은 같음 → 환경 차이 (api 는 fetch, bot 은 interaction.member) 만 분리하고 정책 부분만 공유.

### 2.2 안전망 부재
- **테스트 0건**. 도메인 핵심(MMR 계산, 라이엇 ID 파싱, 배치 인서트) 이 회귀 가능성 노출.
- **린트 0설정**. 코드 스타일 일관성 / 잠재 버그 (unused vars, no-explicit-any 등) 자동 검출 부재.
- **CI 0건** (D1 백업 GHA 외): 머지 전 typecheck/lint/test 자동 실행 없음.

### 2.3 잠재 일관성 이슈 (확인 필요)
- 에러 처리 패턴: `try/catch + reply.code(...)` 가 라우트마다 반복? 공통 errorBoundary 가능?
- env 검증: 시작 시 필수 env 누락 검사가 분산되어 있음 (각 호출 지점에서 throw) → 부팅 시점 일괄 검증 + zod 스키마?
- D1 helper (`query`/`queryOne`/`execute`/`batch`) 호출 패턴 — 트랜잭션 경계가 명시적인지?

---

## 3. Wave 정의 (의존성 순서)

```
Wave 1: 정적 도구 기반 (lint/format/CI)
   ↓
Wave 2: 테스트 기반 (vitest + core 순수 로직)
   ↓
Wave 3: God-file 분해 (PickBan / routes / EntryEditing / recruit)
   ↓
Wave 4: 횡단 정리 (error handling / env validation / logger 일관성)
   ↓
Wave 5: 통합 테스트 (api + bot, D1 throwaway)
   ↓
(선택) Wave 6: 모더나이제이션 (Node 22 baseline / deps / ESM 패턴)
```

각 Wave 는 독립 머지 가능. 1 → 2 는 강한 선후 (린트 베이스라인이 없으면 테스트 코드도 스타일 표류).

---

## 4. 각 Wave 상세

### Wave 1 ✅ — 정적 도구 기반 (2026-05-01 완료, PR #13)

**적용**
- `@biomejs/biome` 2.4.13 + `biome.json` (tab/100/double/semi/trailing-all — 현 스타일 보존)
- linter recommended + 조정 (a11y/noConsole/noNonNullAssertion/useExhaustiveDependencies 는 warn 으로 점진 정리)
- `.github/workflows/ci.yml` — pnpm + node 22, **build core → typecheck → lint** (build 가드 필수: 앱이 core/dist 의 .d.ts 에 의존)
- baseline `biome check --write` 적용 (79 files mechanical), 4 manual fix (unused var/import + implicit any 2건)
- `.git-blame-ignore-revs` 등록 (squash sha `630a99c`)

**측정**
- lint errors 196 → **0**
- lint warnings 38 → 123 (a11y/noConsole 등 — Wave 4 점진 정리)
- typecheck 통과
- CI 첫 PR 가드 동작 검증 ✓

---

### Wave 2 ✅ — 테스트 기반 (2026-05-01 완료, PR #15)

**적용**
- vitest 4.1.5 + @vitest/coverage-v8 + `vitest.config.ts` (root, monorepo 친화)
- **3 test 파일 / 37 테스트 / 108ms**
  - `packages/core/src/mmr/elo.test.ts` (15) — expectedScore/updateElo/applyGameElo + zero-sum invariant
  - `packages/core/src/riot/account.test.ts` (9) — parseRiotId 정상/오류 케이스
  - `apps/bot/src/utils/riotIdExtract.test.ts` (13) — 별명 → 라이엇 ID 추출
- root scripts: test / test:watch / test:coverage
- CI 에 `pnpm test` step 추가

**측정**
- 테스트 통과: 37/37
- mmr/elo coverage: 100%
- riot/parseRiotId coverage: 100%
- 전체 core coverage: 1~3% (db/* 등 미테스트 — Wave 5 통합테스트로 보강)

**스킵 사유**
- `db/admin.ts` 순수 헬퍼: 검토 결과 모든 함수가 D1 의존 (async). 통합테스트 (W5) 영역으로 이관
- datadragon: fetch + 캐시 위주, 단위 테스트 효익 낮음. 통합테스트 영역

---

### Wave 3 — God-file 분해 (예상 4~6h, **가장 큼**)

**원칙**: 한 번에 하나씩. 분해 후 동작·외부 시그니처 검증 → 머지 → 다음.

#### 3.1 `apps/api/src/http/routes.ts` (850 → ~150 + 도메인 파일들)
- 분할 후보:
  - `routes/auth.ts` (session, OAuth2 token exchange)
  - `routes/series.ts`
  - `routes/picks.ts`
  - `routes/recruit.ts`
  - `routes/internal.ts` (notify, heartbeat)
  - `routes/admin.ts` (있다면)
- `registerRoutes(app)` 만 export, 내부에서 각 파일의 register 호출
- helper (`requireSession`, `requireEditor`, `requireInternalKey`) 는 `routes/_auth-helpers.ts` 로 추출

#### 3.2 `apps/activity/src/screens/PickBan.tsx` (1530 → 메인 ~300 + 서브)
- 서브컴포넌트 추출:
  - `PickBan/ChampionGrid.tsx` (그리드 + 검색)
  - `PickBan/SlotRow.tsx` (BAN/PICK 슬롯 행)
  - `PickBan/SidePicker.tsx`
  - `PickBan/ResultEntry.tsx` (승팀 + duration)
  - `PickBan/HardFearlessIndicator.tsx`
- 도메인 훅 추출:
  - `usePickBanState` — 시리즈 상태 + draft + WS 동기화
  - `useChampionFilter` — 검색/카테고리
- 상태 라이브러리 일관성 점검 (zustand/jotai 둘 중 하나로)

#### 3.3 `apps/activity/src/screens/EntryEditing.tsx` (826)
- 서브:
  - `EntryEditing/SlotBoard.tsx` (DnD)
  - `EntryEditing/CandidatePool.tsx` (가로 컴팩트 카드)
  - `EntryEditing/PlayerCard.tsx`
- 훅:
  - `useEntryEditing` — slot assignment + 제출

#### 3.4 `apps/bot/src/commands/recruit.ts` (664)
- 분할:
  - `recruit/command.ts` (data + execute)
  - `recruit/buttons.ts` (handleButton)
  - `recruit/selects.ts` (StringSelect / UserSelect)
  - `recruit/messageBuilder.ts` (V2 컴포넌트 빌드)
- 한 디렉토리 안에 묶어서 import 깔끔하게

**산출물**: 4개 PR (각 분해 단위마다)

**Exit**: 위 4 파일 모두 ≤ 350 LOC. 남은 큰 파일은 본질적 복잡도 (예: PickBan 메인 = 오케스트레이션) 만.

---

### Wave 4 — 횡단 정리 (예상 2h)

**작업**
1. **env 검증 일원화** — `packages/core/src/env.ts` 신규
   - zod 스키마로 부팅 시 필수 env 검증 (`DISCORD_TOKEN`, `CLIENT_ID`, `CF_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_API_TOKEN`, `INTERNAL_API_KEY` 등)
   - 누락이면 명확한 에러로 부팅 실패 (현재는 사용 시점에 throw — 에러 위치 제각각)
2. **operator gate 정책 공유** — 환경 차이만 어댑터로 분리
   - `packages/core/src/auth/operator-policy.ts` (순수 정책 — role id 매칭)
   - api/bot 각자 어댑터에서 호출
3. **에러 응답 일관성** — Fastify error handler 1개로 통합
   - `app.setErrorHandler` 등록 → 모든 라우트의 catch 보일러플레이트 제거
4. **로거 일관성** — `log.info({ key1, key2 }, "msg")` 패턴 통일 검증 (스트링 보간 X)

**Exit**: 부팅 시 env 누락 → 즉시 명확한 에러. 라우트 catch 보일러플레이트 제거. operator 정책 단일 소스.

---

### Wave 5 — 통합 테스트 (예상 4h)

**목표**: 핵심 시리즈 라이프사이클이 회귀 없이 동작함을 자동 보장.

**작업**
1. **D1 throwaway harness** — vitest setup 에서 임시 D1 DB (별도 ID) 마이그레이션 + teardown
2. **api 통합 테스트** — Fastify inject 로 in-memory 요청
   - OAuth2 5-stage 흐름 (mocked discord.com fetch)
   - 시리즈 INSERT/픽/밴/결과/되돌리기 happy path
   - operator gate 가드
3. **bot 명령 스모크** — interaction mock 으로 슬래시 실행 → 응답 형태 검증
   - 위험성 낮은 read-only 부터 (`/내정보`, `/내전기록`)
4. **CI 에 통합 테스트 step** — D1 비밀 토큰 필요 → secrets 사용

**Exit**: PR 머지 전 시리즈 happy path + admin 가드 자동 검증.

---

### Wave 6 (선택) — 모더나이제이션 (예상 1.5h)

**작업**
1. Dockerfile baseline `node:20-alpine` → `node:22-alpine` (wrangler 와 정합)
2. 의존성 최신화 (`pnpm up -L --interactive`) — major bump 는 한 PR 씩
3. ESM 패턴 점검 — `__dirname` 등 CJS 잔재 검사
4. native fetch 활용 점검 — `node-fetch` 잔재 있으면 제거

**Exit**: 모든 컨테이너 Node 22, deps 최신, ESM-only.

---

## 5. 작업 규칙

- **브랜치**: 항상 `git checkout main && git pull --ff-only` 후 분기 (memory: feedback_branch_from_origin)
- **PR 크기**: ≤ 400 라인 권장. 초과 시 분해.
- **PR 제목**: `refactor(domain): summary` 또는 `test(domain): summary` — feature 와 구분
- **타입체크**: `pnpm -r typecheck` 매 PR 통과 필수
- **버전**: 동작 변경 없으면 patch bump 하지 않음 (배포 안 하므로). docker 이미지 새로 push 하지 않음
- **운영 영향 변경 시**: 별도 release PR 로 분리, 배포 절차 명시

---

## 6. 리스크 / 대응

| 리스크 | 대응 |
|---|---|
| 분해 PR 의 import 경로 폭증으로 머지 충돌 | Wave 3 동안은 큰 신규 기능 동결 |
| 테스트 fixture 가 prod D1 데이터에 의존하면 깨짐 | throwaway DB 항상 별도 ID, 마이그레이션은 동일 schema |
| biome 자동 포맷이 git blame 흐림 | `.git-blame-ignore-revs` 에 baseline 커밋 추가 |
| Wave 3 작업 도중 사용자 사용 시점에 동작 다름 | PR 머지 전 로컬 docker compose up 으로 1회 시연 |
| operator 가드 변경 시 본인 권한 잠금 | Wave 4 정책 변경 PR 은 dry-run 모드 우선 |

---

## 7. 측정 지표 — before / after

| 지표 | 현재 (2026-05-01) | 목표 |
|---|---|---|
| LOC > 500 인 파일 수 | 4 | 0 |
| Test 파일 수 | 0 | 20+ |
| core 패키지 coverage | 0% | ≥ 60% |
| Lint 위반 | 측정 안 됨 | 0 (CI 가드) |
| 부팅 시 env 누락 → 에러 위치 | 사용 시점 | 부팅 즉시 |
| api 라우트 파일 평균 LOC | 850 (단일) | < 200 (분할) |

---

## 8. 진행 순서 권장 (작업자 관점)

1. **오늘**: Wave 1 (biome + CI). 이후 모든 작업의 가드.
2. **이번 주**: Wave 2 (vitest + core 단위). 가장 가치 높음.
3. **다음 주**: Wave 3.1 (routes.ts 분해) — api 작업 흐름 영향 줘서 먼저
4. **그 다음**: Wave 3.2 (PickBan) — 가장 큼. 단계적으로 PR 4~6개로 쪼갬
5. Wave 3.3, 3.4 → Wave 4 → Wave 5 순
6. Wave 6 은 마지막 또는 사이사이 끼워넣기

---

## 9. 결정 필요 사항

- [ ] Wave 1 lint 도구: biome (추천) vs eslint+prettier 조합. → **biome 권장** (속도, 단일 config)
- [ ] Wave 5 통합 테스트의 D1 — 별도 throwaway DB ID 발급 필요? 또는 별도 무료 D1 워크스페이스?
- [ ] Wave 3.2 의 상태 라이브러리 일관성 — 현재 zustand/jotai 둘 다 쓰는지 확인 필요. 하나로 통합?
- [ ] coverage 목표 % 의 현실성 — 첫 측정 후 재조정
