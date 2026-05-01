# 개발환경 — 테스트 실행 가이드

> 처음 설정부터 일상 TDD 루프, 디버깅, 커버리지 로컬 확인까지.
> 인프라/패턴은 [`testing/infrastructure.md`](./testing/infrastructure.md) 참고.

---

## 1. 최초 셋업

### 1.1 사전 요구

| 도구 | 버전 | 비고 |
|---|---|---|
| Node | **22.x** | `engines.node: ">=22"`. nvm/volta 권장 |
| pnpm | **10.x** | corepack 으로 자동 (`corepack enable`) |
| build tools | python3 / make / g++ | `better-sqlite3` native build (alpine 외 보통 기본 설치됨) |

### 1.2 클론 + 설치

```bash
git clone https://github.com/Longcat2957/mookbot_v2
cd mookbot_v2
pnpm install --frozen-lockfile
```

`pnpm install` 이 자동으로 `better-sqlite3` native binding 빌드 (root `package.json` 의 `pnpm.onlyBuiltDependencies` 가 보안 정책 통과).

빌드 실패 시:
```bash
pnpm rebuild better-sqlite3
# 또는 강제 빌드
cd node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3 && npx prebuild-install
```

### 1.3 core 빌드 (선택)

api/bot 의 typecheck 가 `@mookbot/core` 의 `dist/*.d.ts` 를 참조 — core 빌드 필요.
```bash
pnpm --filter @mookbot/core build
```

테스트 실행에는 빌드 불필요 (vitest alias 가 src/ 로 redirect).

---

## 2. 일상 테스트 실행

### 2.1 핵심 명령

```bash
pnpm test              # 한 번 실행 (CI 와 동일 — 171 tests, ~400ms)
pnpm test:watch        # 파일 변경 감지하며 재실행
pnpm test:coverage     # v8 coverage 측정 + HTML 리포트 생성
pnpm typecheck         # tsc --noEmit 전 워크스페이스
pnpm check             # biome lint + format 체크
pnpm check:fix         # biome 자동 수정 (안전한 fix 만)
```

### 2.2 단일 파일 / 패턴 실행

```bash
# 파일 1개
pnpm exec vitest run packages/core/src/db/recruitments.test.ts

# describe/it 이름 패턴
pnpm exec vitest -t "createRecruitment"
pnpm exec vitest -t "Bo3"

# 디렉토리 단위
pnpm exec vitest run packages/core/src/db/
```

### 2.3 watch 모드 흐름 (TDD)

```bash
pnpm test:watch
```

vitest UI 모드 (인터랙티브):
```bash
pnpm exec vitest --ui    # 브라우저에 테스트 explorer 열림
```
실패 테스트 클릭 → 코드 → 저장 → 자동 재실행. UI 가 stack trace + diff 깔끔하게 보여줌.

### 2.4 테스트 격리 정책

매 `beforeEach` 가 새 in-memory SQLite 만듦 → 테스트 간 누출 0.
실패 시 가장 흔한 원인:
- env 변수 (다른 테스트가 set 후 미복구)
- 모듈-level state (perms cache, pino transport 등)
- driver state (다른 파일이 `__resetDriver` 안 부르고 끝남)

---

## 3. 새 테스트 작성

### 3.1 빠른 시작 (core 단위)

```ts
// packages/core/src/db/yourModule.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb, installDbDriver, type TestDb } from "@mookbot/core/test-utils/db-harness";
import { yourFunction } from "./yourModule.js";

let db: TestDb;
beforeEach(() => {
  db = createTestDb();
  installDbDriver(db);
});

describe("yourFunction", () => {
  it("happy path", async () => {
    expect(await yourFunction(...)).toBe(...);
  });
});
```

### 3.2 빠른 시작 (api 통합)

```ts
// apps/api/src/http/yourRoute.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { __resetDriver } from "@mookbot/core/test-utils/db-harness";
import { buildTestApp, signSid } from "../test-utils/build-app.js";

afterEach(() => __resetDriver());

it("POST /api/your-route", async () => {
  const { app, db } = await buildTestApp({ canEdit: true });
  // db.prepare("INSERT INTO ...").run(...) 로 fixture
  const res = await app.inject({
    method: "POST",
    url: "/api/your-route",
    cookies: { sid: signSid(app, "operator") },
    payload: { ... },
  });
  expect(res.statusCode).toBe(200);
});
```

상세 패턴 / 컨벤션은 [`testing/infrastructure.md`](./testing/infrastructure.md#6-새-테스트-파일-작성-가이드).

---

## 4. 디버깅

### 4.1 단일 테스트만 isolation

`it.only(...)` 로 한 케이스만 실행:
```ts
it.only("디버깅 중인 케이스", async () => { ... });
```
또는 watch 모드에서 다른 파일 무시:
```bash
pnpm exec vitest run packages/core/src/db/series.test.ts
```

### 4.2 console.log 디버그

테스트 중 `console.log` 는 stdout 에 그대로 출력. biome 의 `noConsole` 룰은 테스트 파일에서 `off` (override) 라 자유롭게 사용 OK.

### 4.3 Node inspector

```bash
node --inspect-brk node_modules/.pnpm/vitest@*/node_modules/vitest/vitest.mjs run path/to/test.ts
```
chrome://inspect 또는 VS Code 의 "Attach to Node Process" 로 붙음.

### 4.4 SQL 쿼리 추적

`installDbDriver` 가 wrap 하는 driver 함수에 `console.log` 추가하면 모든 SQL 쿼리 로그:
```ts
// packages/core/src/test-utils/db-harness.ts (임시)
async query(sql, params) { console.log("Q:", sql, params); ... }
```
테스트 끝나면 revert.

### 4.5 Fastify 응답 디버그

`buildTestApp` 의 `Fastify({ logger: false })` 를 `logger: { level: "trace" }` 로 임시 변경 → 모든 라우트 처리 로그 출력.

---

## 5. 커버리지 로컬 확인

```bash
pnpm test:coverage
# → text 리포트가 stdout
# → HTML 리포트가 ./coverage/index.html
```

브라우저로:
```bash
xdg-open coverage/index.html  # Linux
open coverage/index.html       # macOS
```

핫스팟:
- 빨간 줄 = 미커버
- 노란 줄 = 부분 커버 (branch 일부만)

`vitest.config.ts` 의 `coverage.exclude` 에서 측정 제외 영역 확인. 테스트 가치 없는 영역 (CLI 스크립트, React UI, 외부 통신 모듈) 은 제외 처리됨.

---

## 6. 흔한 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| `Cannot find package '@mookbot/core/test-utils/db-harness'` | core 의 exports 매핑 또는 vitest alias 미반영 | `pnpm install` 다시, `vitest.config.ts` alias 확인 |
| `Could not locate the bindings file` (better-sqlite3) | native build 누락 | `pnpm rebuild better-sqlite3` |
| `FOREIGN KEY constraint failed` (test) | fixture 가 부모 row 없이 자식 INSERT | `upsertUser` / `createSeason` 등으로 부모 먼저 seed |
| `vi.mocked(...).mockImplementation is not a function` | (legacy 패턴) — 현재는 driver pattern 사용. installDbDriver 로 교체 | |
| api 통합 테스트 500 — DB 안 찍힘 | driver swap 이 다른 모듈 인스턴스에 적용 (예: dist/ 와 src/ 분리) | vitest alias `@mookbot/core` 확인 |
| port 3001 in use | `bot/healthServer` 가 listen 시도 | bot 테스트는 healthServer 안 거침 — start/stop 제어. local docker compose 가 점유했으면 stop |
| dotenv 가 .env 못 찾음 | 테스트는 dotenv 안 부름 | env 가 필요하면 `process.env.X = "test"` 직접 set |

---

## 7. CI 와 동일하게 검증

머지 전 CI 가 돌리는 것과 동일한 검증:
```bash
pnpm install --frozen-lockfile
pnpm --filter @mookbot/core build
pnpm -r typecheck
pnpm exec biome check .
pnpm test
```
모두 green 이면 CI 에서도 green. 자세한 CI 동작은 [`cicd.md`](./cicd.md).

---

## 8. (선택) IDE 통합

### VS Code

권장 확장:
- **Vitest** (vitest.explorer) — 사이드바 테스트 explorer + run/debug 단일 클릭
- **Biome** (biomejs.biome) — 저장 시 자동 format + lint 표시

`.vscode/settings.json` (선택, 사용자 개인 설정):
```jsonc
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": { "quickfix.biome": "explicit" }
}
```

### JetBrains

vitest는 IDE 빌트인 (Run → 'vitest' run config). biome plugin 별도 설치.

---

## 9. 한 페이지 cheat sheet

```
설치:        pnpm install --frozen-lockfile
core 빌드:   pnpm --filter @mookbot/core build
테스트:      pnpm test  | pnpm test:watch  | pnpm test:coverage
단일 파일:   pnpm exec vitest run path/to/file.test.ts
패턴:        pnpm exec vitest -t "이름 패턴"
UI:          pnpm exec vitest --ui
타입:        pnpm typecheck
린트:        pnpm check  | pnpm check:fix
CI 동등:     pnpm install --frozen-lockfile && pnpm --filter @mookbot/core build && pnpm -r typecheck && pnpm exec biome check . && pnpm test
```
