# Testing — Infrastructure

테스트가 어떻게 동작하는지. 새 테스트 파일 작성 시 참고.

---

## 1. vitest 설정 (`vitest.config.ts`)

### 1.1 핵심 옵션

```ts
{
  resolve: {
    alias: [
      // 테스트는 source 경로로 통일 — api 가 import 하는 @mookbot/core 가
      // dist/ 가 아닌 src/ 모듈을 가리키게 해야 d1 driver swap 이 같은 모듈
      // 인스턴스에 적용됨.
      { find: /^@mookbot\/core\/test-utils\/db-harness$/, replacement: ".../packages/core/src/test-utils/db-harness.ts" },
      { find: /^@mookbot\/core$/,                          replacement: ".../packages/core/src/index.ts" },
    ],
  },
  test: {
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.svelte-kit/**"],
    coverage: { provider: "v8", reporter: ["text","html"], include: [...], exclude: [...] },
  },
}
```

### 1.2 alias 가 필요한 이유

`apps/api` 의 production 코드는 `import { cloudflare } from "@mookbot/core"` 로 함. 이게 `node_modules` 의 `@mookbot/core/dist/index.js` 로 resolve 되면, 테스트가 swap 한 driver (src 의 d1.ts) 와 **다른 모듈 인스턴스** 가 됨 → 테스트가 무효.

alias 가 모든 import 를 src 경로로 redirect → 같은 모듈 인스턴스 → driver swap 가 모든 호출에 적용.

### 1.3 coverage exclude 정책

**측정 대상**: 단위/통합 테스트 가치 있는 도메인 코드만.
**제외**: CLI 스크립트, React UI, 부팅/외부 통신 (datadragon/riot/d1 HTTP/logger).

전체 목록은 `vitest.config.ts` 참고.

---

## 2. DB 하네스 (`packages/core/src/test-utils/db-harness.ts`)

### 2.1 핵심 export

```ts
export function createTestDb(): TestDb;        // 새 in-memory SQLite + 스키마 적용
export function installDbDriver(db: TestDb);   // d1.ts driver 를 SQLite 백엔드로 swap
export function __resetDriver(): void;         // production HTTP driver 로 복구
```

### 2.2 schema.sql 처리

`packages/core/src/db/schema.sql` 을 읽어서 in-memory DB 에 적용. 단,
파일 끝의 ALTER TABLE 블록 (기존 DB 보강용) 은 fresh DB 에서 "duplicate column"
으로 실패 → 하네스가 ALTER 라인만 strip 후 exec.

### 2.3 driver indirection

`packages/core/src/cloudflare/d1.ts` 가 `D1Driver` 인터페이스 + `__setDriver/__resetDriver` 를 export. `query/queryOne/execute/batch` 가 driver 위임.
production 은 default `httpDriver` 사용 (Cloudflare HTTP API). 테스트는 SQLite-backed driver 로 swap. 운영 영향 = 함수 호출 1회 (HTTP fetch latency 대비 무시 가능).

### 2.4 사용 패턴

```ts
import { createTestDb, installDbDriver, __resetDriver, type TestDb } from "@mookbot/core/test-utils/db-harness";

let db: TestDb;
beforeEach(() => {
  db = createTestDb();
  installDbDriver(db);
});
// (선택) afterEach(() => __resetDriver());
```

매 `beforeEach` 가 새 DB → 테스트 간 격리. driver 는 module-level state 라
파일 간에도 마지막 install 이 active. 보통 문제 없음.

### 2.5 fixture seeding 패턴

API 함수로 seed (선호):
```ts
const season = await createSeason("Test");
await upsertUser("u1", "Alice");
const series = await createSeries({ ... });
```

직접 INSERT (격리/속도):
```ts
db.prepare("INSERT INTO games (...) VALUES (...)").run(...);
```

API 사용은 round-trip 검증을 같이, 직접 INSERT 는 fixture 만 빠르게.

---

## 3. API 테스트 하네스 (`apps/api/src/test-utils/build-app.ts`)

### 3.1 핵심 export

```ts
export function buildTestApp(opts?: { canEdit?: boolean }):
  Promise<{ app: FastifyInstance; db: TestDb }>;

export function signSid(app: FastifyInstance, userId: string): string;
```

### 3.2 동작

1. `canEdit` 토글에 따라 perms 모듈의 `__setCanEditOverrideForTest(canEdit)` 호출 — `userCanEdit()` 가 즉시 그 값 반환 (vi.mock 불필요)
2. `clearPermsCache()` — 이전 테스트의 멤버 캐시 클리어
3. `createTestDb()` + `installDbDriver(db)` — d1 swap
4. Fastify 인스턴스 생성 + cookie + `setErrorHandler(fastifyErrorHandler)`
5. `registerRoutes(app)` — 모든 라우트 등록 (listen 안 함)

### 3.3 canEdit 테스트 override

operator 권한 검증은 `apps/api/src/auth/perms.ts` 가 처리. production 에서는 길드의
`BalanceTeam` 역할 (또는 `OPERATOR_ROLE_NAME` env override) 보유자만 통과하지만,
테스트는 Discord 길드 fetch 를 피하려고 명시적 override 훅을 사용:

```ts
__setCanEditOverrideForTest(true);   // 모든 사용자 canEdit
__setCanEditOverrideForTest(false);  // 모든 사용자 deny
__setCanEditOverrideForTest(null);   // production 로직 복귀
```

vi.mock 으로 perms 모듈을 갈아엎는 대신 모듈-level mutable flag 로 분기 — 모듈
인스턴스 동기화 문제를 회피.

### 3.4 cookie 서명

Fastify `app.signCookie(value)` 가 SESSION_SECRET 으로 서명한 문자열 반환.
`inject({ cookies: { sid: signSid(app, "user-id") } })` 형태로 전달.

### 3.5 사용 패턴

```ts
import { __resetDriver, type TestDb } from "@mookbot/core/test-utils/db-harness";
import { buildTestApp, signSid } from "../test-utils/build-app.js";

afterEach(() => __resetDriver());

it("...", async () => {
  const { app, db } = await buildTestApp({ canEdit: true });
  // db.prepare(...).run(...) 로 fixture seed
  const res = await app.inject({
    method: "POST",
    url: "/api/...",
    cookies: { sid: signSid(app, "operator") },
    payload: { ... },
  });
  expect(res.statusCode).toBe(200);
  // db 직접 검증 가능
});
```

---

## 4. Mock / Stub 패턴

### 4.1 vi.mock — 사용 안 함

이전 시도에서 cross-package vi.mock 의 모듈 인스턴스 불일치 + hoisting 문제로 driver pattern 으로 대체. 현 코드베이스에 vi.mock 거의 없음 (몇 군데 vi.fn 있을 수 있으나 단순용).

### 4.2 datadragon — 미모킹

`datadragon.getChampionName(N)` 등은 `initDataDragon()` 안 부르면 `"Unknown(N)"`
fallback 반환. 테스트는 챔프 이름 문자열보다 구조/사이드이펙트를 검증하므로 OK.

### 4.3 Discord OAuth — 미모킹

`/api/token`, `/api/session` 은 외부 Discord OAuth API 를 호출. 현재 테스트
범위에 없음 (auth 관련 테스트는 cookie signing 만 검증). 필요 시 global fetch
mock 으로 추가 가능.

### 4.4 환경 변수

테스트가 env 를 set/delete 하면 다른 테스트에 누출 가능. 격리 패턴:

```ts
const prev = process.env.SOMETHING;
process.env.SOMETHING = "test-value";
try {
  // ... test
} finally {
  if (prev) process.env.SOMETHING = prev;
  else delete process.env.SOMETHING;
}
```

`buildTestApp` 자체는 env 를 건드리지 않으므로 (override 훅 사용) 충돌 없음.
`routes.test.ts` 가 INTERNAL_API_KEY 를 세팅할 때는 위 패턴 사용.

---

## 5. 의존성

| 패키지 | 위치 | 용도 |
|---|---|---|
| `vitest` | root devDep | 테스트 러너 |
| `@vitest/coverage-v8` | root devDep | 커버리지 |
| `better-sqlite3` | `packages/core` devDep | in-memory SQLite |
| `@types/better-sqlite3` | `packages/core` devDep | types |

`pnpm.onlyBuiltDependencies: ["better-sqlite3"]` (root package.json) — pnpm 10
보안 정책 우회, CI 에서 native binding 자동 빌드.

---

## 6. 새 테스트 파일 작성 가이드

### 6.1 파일 위치

`*.ts` 옆에 `*.test.ts` (vitest 기본 컨벤션). 디렉토리 분리 안 함.

### 6.2 imports

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, installDbDriver, type TestDb } from "@mookbot/core/test-utils/db-harness";
// (필요 시) import { __resetDriver } from "@mookbot/core/test-utils/db-harness";
import { yourFunction } from "./yourModule.js";
```

### 6.3 구조

```ts
let db: TestDb;
beforeEach(async () => {
  db = createTestDb();
  installDbDriver(db);
  // shared fixture (선택)
});

describe("function name OR feature", () => {
  it("happy path 한 줄 설명", async () => { /* ... */ });
  it("error path 한 줄 설명", async () => { /* ... */ });
});
```

### 6.4 it 이름 컨벤션

- 한국어 + 영어 자유 — 기존 코드 톤 유지
- 행위 → 결과 형식: "X 가 Y 한다", "X → Y", "rejects when X"
- 예: `"createRecruitment + getRecruitment round-trip"`, `"Game N 의 N-1 미완료 → 409"`

### 6.5 assert 스타일

```ts
expect(value).toBe(exact);              // primitives
expect(value).toEqual(deep);            // objects/arrays
expect(value).toMatchObject(partial);   // 부분 일치
expect(value).toBeCloseTo(num, digits); // float
expect(fn).toThrow(/regex/);            // sync throw
await expect(asyncFn()).rejects.toThrow(/regex/); // async throw
```

### 6.6 격리 체크리스트

- [ ] beforeEach 가 새 DB 만드는가
- [ ] env 변경 시 try/finally 로 복구
- [ ] 모듈 레벨 state (cache 등) 초기화
