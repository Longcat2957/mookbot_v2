# Testing — Overview

> **2026-05-01 기준 / v0.2.8 / 171 tests / 16 파일**

## 1. 한 줄 요약

`vitest` + in-memory SQLite (better-sqlite3) + Fastify inject + Discord interaction mocking. CI 가 모든 PR 에서 typecheck + biome + tests 자동 검증.

## 2. 실행

| 명령 | 동작 |
|---|---|
| `pnpm test` | 한 번 실행 (CI 모드) |
| `pnpm test:watch` | 파일 변경 감지하며 재실행 |
| `pnpm test:coverage` | v8 coverage HTML + text 리포트 |
| `pnpm exec vitest run path/to/file.test.ts` | 단일 파일 |
| `pnpm exec vitest -t "describe 이름"` | 패턴 매칭 실행 |

## 3. 테스트 카테고리

| 카테고리 | 파일 수 | 테스트 수 | 위치 | 인프라 |
|---|---|---|---|---|
| **Pure 로직** | 3 | 37 | `packages/core/src/{mmr,riot}/`, `apps/bot/src/utils/` | 없음 (순수 함수) |
| **DB 모듈** | 11 | 107 | `packages/core/src/db/*.test.ts` | in-memory SQLite + d1 driver swap |
| **API smoke** | 1 | 10 | `apps/api/src/http/routes.test.ts` | Fastify inject (DB X) |
| **API 통합** | 1 | 17 | `apps/api/src/http/db-routes.test.ts` | Fastify inject + SQLite |
| **합계** | **16** | **171** | | |

## 4. CI 가드

`.github/workflows/ci.yml` — push to main + PR 시 자동 실행. **3 단계 모두 green** 일 때만 머지 가능:
1. `pnpm -r typecheck`
2. `pnpm exec biome check .` (lint + format)
3. `pnpm test` (171 tests, ~400ms)

## 5. 커버리지 (도메인 핵심만, CLI/UI 제외)

| 영역 | Statements | Lines | Functions |
|---|---|---|---|
| `packages/core/src/db/` | 96.81% | **98.4%** | **98%** (사실상 100% — error catch 4 라인만 미커버) |
| 측정 대상 전체 | 96.95% | 98.47% | 98.07% |

**제외 영역** (vitest.config.ts coverage.exclude):
- CLI 스크립트 (`db/seed.ts`, `migrate.ts`, `dump.ts`, `restore.ts`, `reset.ts`, `backup.ts`, `_assert.ts`, `bot/deploy-commands.ts`)
- React UI (`apps/activity/src/**`)
- Discord 인터랙션 (`apps/bot/src/commands/**`, `events/**`, `webhooks/**`)
- 부팅 / 외부 통신 (`d1.ts`, `datadragon/`, `riot/`, `logger.ts`, `auth/`)

## 6. 문서 가이드

- [`infrastructure.md`](./infrastructure.md) — 어떻게 테스트가 동작하는지 (vitest config, db-harness, build-app, mock 패턴)
- [`core-tests.md`](./core-tests.md) — packages/core 14 파일 file-by-file 설명
- [`app-tests.md`](./app-tests.md) — apps/api + apps/bot 테스트 설명
