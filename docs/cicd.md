# CI / CD — GitHub Actions

> Repo 의 GHA 워크플로 정리. **2026-05-01 v0.2.8 기준**.
> 변경된 워크플로는 push 즉시 main 의 `.github/workflows/` 가 진실 — 이 문서는 스냅샷.

---

## 1. 워크플로 목록

| 파일 | 역할 | Trigger | Run time |
|---|---|---|---|
| `.github/workflows/ci.yml` | typecheck + lint + test 가드 | push to main, PR | ~40s |
| `.github/workflows/d1-backup.yml` | D1 데이터베이스 일일 export → artifact | cron 18:00 UTC (= 03:00 KST), manual | ~25s |

배포(Docker push, VPS pull/up) 는 GHA 가 아닌 **사용자 수동 실행** (`pnpm docker:release` + ssh) — memory: `reference_vps_deploy`.

---

## 2. CI workflow (`ci.yml`)

### 2.1 목적

모든 PR / main 푸시에서 **회귀 자동 차단**. 3 단계 gate:
1. **typecheck** — `pnpm -r typecheck`
2. **lint** — `pnpm exec biome check .`
3. **test** — `pnpm test` (171 tests)

3개 중 하나라도 실패하면 PR 머지 버튼이 적색 → 차단.

### 2.2 트리거

```yaml
on:
  push:
    branches: [main]      # main 직접 push 시 (보통 squash 머지 결과)
  pull_request: {}         # 모든 브랜치의 PR
```

### 2.3 동시 실행 정책

```yaml
concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```
같은 브랜치에 새 push 가 오면 진행 중 run 자동 취소 — 항상 최신 commit 만 검증.

### 2.4 Job 단계

| step | 명령 / 액션 | 비고 |
|---|---|---|
| checkout | `actions/checkout@v4` | |
| setup pnpm | `pnpm/action-setup@v4` (version 10) | |
| setup node | `actions/setup-node@v4` (node 22, cache pnpm) | pnpm store 캐싱 |
| install | `pnpm install --frozen-lockfile` | lockfile 변경 시도 → 실패 |
| build core | `pnpm --filter @mookbot/core build` | 앱 typecheck 가 `dist/*.d.ts` 참조 |
| typecheck | `pnpm -r typecheck` | 모든 워크스페이스 |
| lint | `pnpm exec biome check .` | warnings 는 통과, errors 만 차단 |
| test | `pnpm test` | 171 tests, vitest 4 |

### 2.5 native 의존성

`better-sqlite3` 는 native module — 첫 install 시 prebuild-install 이 prebuild binary 다운로드 시도, 실패 시 node-gyp rebuild. CI 환경 (ubuntu-latest + node 22) 에선 prebuild binary 가 항상 제공됨 → ~3s.

`pnpm.onlyBuiltDependencies: ["better-sqlite3"]` (root `package.json`) 가 pnpm 10 의 install-script 보안 정책을 통과시킴.

### 2.6 권한

```yaml
permissions:
  contents: read     # 최소 — checkout 만 필요
```

### 2.7 실패 케이스 / 디버깅

- typecheck 실패 → 메시지에 파일 라인 명시
- biome 실패 → `pnpm exec biome check . --diagnostic-level=error` 로 errors 만 추출
- test 실패 → vitest 가 stack trace + diff 출력

로컬 재현:
```bash
pnpm install --frozen-lockfile
pnpm --filter @mookbot/core build
pnpm -r typecheck && pnpm exec biome check . && pnpm test
```

### 2.8 추가 step 후보 (현재 없음)

- `pnpm docker:build` — Dockerfile 빌드 검증 (현재 안 함, push 시점 = 사용자 docker:release 시)
- 보안 스캔 (`npm audit`, `osv-scanner` 등) — 필요 시 별도 workflow
- 성능 / 빌드 사이즈 추적 — Phase 5 후보

---

## 3. D1 백업 workflow (`d1-backup.yml`)

### 3.1 목적

매일 한국 시간 03시 (트래픽 0 시각) D1 데이터베이스를 SQL 로 export → GitHub Actions artifact 로 90일 보관. 운영 데이터 손상 시 복원 source.

### 3.2 트리거

```yaml
on:
  schedule:
    - cron: '0 18 * * *'    # 18:00 UTC = 03:00 KST 다음날
  workflow_dispatch: {}      # 수동 실행 (Actions 탭에서 "Run workflow")
```

### 3.3 동시 실행 정책

```yaml
concurrency:
  group: d1-backup
  cancel-in-progress: false  # 진행 중 run 은 끝까지 — 부분 export 회피
```

### 3.4 Job 단계

| step | 명령 |
|---|---|
| checkout | `actions/checkout@v4` |
| setup node | `actions/setup-node@v4` (node 22) — wrangler 가 22+ 요구 |
| install wrangler | `npm i -g wrangler@latest` |
| export D1 | `wrangler d1 export "${DB_NAME}" --remote --output=...sql` → gzip |
| upload artifact | `actions/upload-artifact@v4`, retention 90 days |

### 3.5 환경 변수

| 이름 | 출처 | 비고 |
|---|---|---|
| `DB_NAME` | workflow env | `mookbot_dev` (Cloudflare D1 dashboard 의 DB 이름) |
| `CLOUDFLARE_API_TOKEN` | repo secret | wrangler 인증 (D1:Edit + Account:Read) |
| `CLOUDFLARE_ACCOUNT_ID` | repo secret | wrangler account 명시 |

secrets 는 repo Settings → Secrets and variables → Actions 에서 관리.

### 3.6 산출물 (artifact)

- 이름: `d1-backup-YYYYMMDD-HHMMSS`
- 내용: `d1-backup-mookbot_dev-<stamp>.sql.gz`
- retention: 90 일
- 다운로드: `gh run download <run-id>` 또는 Actions 페이지

### 3.7 실패 케이스

- wrangler auth 실패 → secret 만료 / 권한 부족
- D1 export 도중 fail → wrangler 가 일시 backoff 후 재시도, retention=15min timeout
- artifact 업로드 0 byte → `if-no-files-found: error` 로 명시적 실패

### 3.8 ⚠ 운영 주의

`wrangler d1 export --remote` 는 **export 동안 D1 unavailable** (`memory: project_d1_export_blocks`). 03 시 KST 트래픽 0 가정 위에서만 안전. 트래픽 패턴 변경 시 시각 재검토.

### 3.9 복원 (artifact → D1)

```bash
gh run download <run-id> --dir /tmp/restore
gunzip /tmp/restore/d1-backup-*.sql.gz
wrangler d1 execute mookbot_dev --remote --file=/tmp/restore/d1-backup-*.sql
# 또는 수동 검증 후 적용
```

복원 절차 자체는 `packages/core/src/db/restore.ts` (CLI 스크립트) 참조.

### 3.10 자동 검증 routine

내일 03시 백업이 cron 실행됐는지 확인용 routine 등록 가능 (`/schedule` 명령). 현재 trig_014Leo2R7uStqQZTRerKrSed 가 한 번 등록되어 있음 (2026-05-02 09:00 KST 한 번만).

---

## 4. 비밀(secrets) 목록

| Secret | 워크플로 | 용도 |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | d1-backup | wrangler D1 export 인증 |
| `CLOUDFLARE_ACCOUNT_ID` | d1-backup | Cloudflare 계정 식별 |

CI workflow 는 secret 사용 X (오픈 소스 / fork 의 PR 도 그대로 동작).

신규 secret 추가:
1. repo Settings → Secrets and variables → Actions → New repository secret
2. workflow 의 `${{ secrets.NAME }}` 으로 참조

---

## 5. 머지 가드 / 정책

### 5.1 자동 가드

CI green 이 아닌 PR 은 GitHub UI 의 "Merge" 버튼이 차단됨 (확인은 repo Settings → Branches → branch protection 규칙).

### 5.2 main 직접 push 차단

repo branch protection 으로 main 직접 push 차단. 모든 변경은 PR + squash merge 흐름 (memory: `feedback_branch_from_origin`).

### 5.3 Author + co-author

bot 자동 commit 은 footer 에:
```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 6. 새 워크플로 추가 가이드

### 6.1 위치

`.github/workflows/<name>.yml`. 파일명 = workflow 식별자 (Actions 탭 표시).

### 6.2 템플릿 (typecheck/test 와 비슷한 패턴)

```yaml
name: <Name>

on:
  push:
    branches: [main]
  pull_request: {}
  # 또는 schedule / workflow_dispatch

permissions:
  contents: read

concurrency:
  group: <name>-${{ github.ref }}
  cancel-in-progress: true

jobs:
  <job>:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: pnpm }
      - run: pnpm install --frozen-lockfile
      # ... 작업
```

### 6.3 PR 흐름

새 workflow 추가도 PR + squash merge — 머지된 후부터 다음 PR 부터 적용됨. **현 PR 자체에는 적용 안 됨** (workflow 는 default branch 의 정의를 사용).

### 6.4 검증

- workflow_dispatch 가 있으면 머지 후 즉시 수동 trigger 로 1회 실행 검증
- cron 은 다음 fire 까지 대기 — 너무 길면 `0 */1 * * *` 같은 임시 자주 실행 후 안정화 시 정상 cron 으로

---

## 7. 비용 / 한도

GitHub Actions Free tier (private repo):
- ubuntu runner: **2,000 분/월** 무료
- 현 사용량 추정:
  - CI: ~40s × 평균 ~10 PR/일 = ~7분/일 = ~210분/월
  - d1-backup: ~25s × 30일 = ~12.5분/월
  - **합계 ~225분/월** — free tier 의 11% 사용

여유 충분. 별도 비용 추적 불요.

---

## 8. 참고 / 관련 문서

- 테스트 실행: [`how_to_dev.md`](./how_to_dev.md)
- 테스트 인프라: [`testing/infrastructure.md`](./testing/infrastructure.md)
- 운영 deploy (수동): repo 루트 [`SETUP.md`](../SETUP.md)
- 메모리: VPS deploy 는 GHA 가 아닌 수동 (release 마다 ssh)
