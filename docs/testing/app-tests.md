# Testing — `apps/api` + `apps/bot` (3 파일 / 27 tests)

| 파일 | tests | 카테고리 |
|---|---|---|
| [`apps/api/src/http/routes.test.ts`](#apsiapisrchttproutestestts) | 10 | API smoke (DB X) |
| [`apps/api/src/http/db-routes.test.ts`](#apsiapisrchttpdb-routestestts) | 17 | API 통합 (DB ✓) |
| [`apps/bot/src/utils/riotIdExtract.test.ts`](#apsbotsrcutilsriotidextracttestts) | 13 | pure |

---

## `apps/api/src/http/routes.test.ts`

**대상**: api 의 인증 / 권한 / smoke. **DB 안 닿는 라우트만**.

**describe 블록**:
- **smoke / health** (2) — `GET /healthz` 200 / `GET /api/healthz/deep` 응답 형태.
- **session / auth** (3) — `GET /api/me` 401 (cookie 없음) / 200 with sid + canEdit true / canEdit false.
- **operator gate** (2) — `POST /api/series` 401 (no cookie) / 403 (non-operator).
- **internal endpoints** (3) — `POST /internal/notify` 503 (key 미설정) / 401 (mismatch) / 200 (correct key).

**핵심**: 인증 미들웨어 (cookie 검증, BalanceTeam 역할 체크, X-Internal-Key) 가 모든 entry point 에서 정확히 동작.

**테스트 인프라**: `buildTestApp({ canEdit })` — perms 모듈의 `__setCanEditOverrideForTest` 훅으로 분기 (자세한 패턴은 [`infrastructure.md`](./infrastructure.md#33-canedit-테스트-override) 참고).

---

## `apps/api/src/http/db-routes.test.ts`

**대상**: api 의 DB-touching 라우트 통합. d1 driver swap 으로 in-memory SQLite 위에서 풀스택 실행.

**describe 블록**:
- **POST /api/series** (3) — happy (CLOSED 모집 → series 생성 + 모집 status CONVERTED) / not found 404 / 이미 CONVERTED 409.
- **GET /api/series** (2) — IN_PROGRESS listing + 참가자 / 빈 리스트.
- **GET /api/series/:id** (3) — detail (series + participants + games + pickbanDraft) / invalid id 400 / not found 404.
- **PUT /api/series/:id/pickban** (1) — draft round-trip (PUT 후 GET 으로 복원).
- **POST /api/series/:id/games** (4) — Bo3 1-0 / TEAM_1 2-0 자동 종료 (status COMPLETED + winning_team 설정) / N-1 미완료 409 / 같은 gameNumber 중복 409.
- **DELETE /api/series/:id/games/last** (2) — 게임 삭제 + MMR 차감 검증 / 게임 0개 409.
- **POST /api/series/:id/revert** (1) — 게임 0개 + IN_PROGRESS → 모집 CLOSED 복귀 + 시리즈 삭제 + recruitmentId 반환.
- **GET /api/recruitments + /api/recruitments/:id** (2) — listing (CLOSED 만) / detail (recruitment + participants + entryDraft).

**핵심**: 라우트 핸들러 로직 + DB 부수 효과를 한 번에 검증. Bo3 자동 종료 + MMR 차감 + 모집 복귀 같은 멀티 단계 트랜잭션이 정확히 동작.

**테스트 인프라**:
- `buildTestApp({ canEdit: true })` 가 SQLite + driver swap 자동
- fixture 는 `db.prepare(...).run(...)` 로 직접 INSERT (속도 + 격리)
- 응답 검증 + DB 직접 조회 검증 양쪽 — `expect(db.prepare("SELECT ...").get()).toEqual(...)`

**미커버 (의도적 스킵)**:
- `/api/token`, `/api/session` (Discord OAuth — global fetch mock 필요)
- `/api/champions` (datadragon 데이터 의존 — initDataDragon() 안 부르면 빈 리스트)
- `/api/me/perms` diagnose 상세

---

## `apps/bot/src/utils/riotIdExtract.test.ts`

**대상**: `apps/bot/src/utils/riotIdExtract.ts` — Discord 별명에서 라이엇 ID 추출 (pure 함수).

**describe 블록**:
- **countHashes** (4) — 0/1/3 hashes + 빈 문자열.
- **extractRiotIdFromDisplayName** (9) — `이름(GameName#TagLine)` 형식 추출. 다양한 케이스:
  - 괄호 없음 → undefined
  - `(GameName#TagLine)` 정상
  - `(GameName)` 만 → 기본 태그 KR1
  - 모호 (전체에 # 2+) → undefined
  - 후행 공백 OK
  - 공백 포함 GameName
  - 빈 괄호 → undefined
  - 다중 괄호 그룹 → 마지막 사용
  - non-default region tag

**핵심**: `/일괄등록` 슬래시가 길드 멤버 닉네임에서 Riot ID 자동 추출하는 휴리스틱. pure 함수라 테스트 격리 100%.

---

## 통합 테스트 추가 가이드

새 라우트 통합 테스트 추가 시:
1. `db-routes.test.ts` 의 패턴 따라가기 — fixture seed → inject → 응답 + DB 검증
2. fixture 헬퍼는 파일 안에 inline 함수로 (`seedRecruitment` 등)
3. canEdit 토글이 필요하면 `buildTestApp({ canEdit: false })`
4. driver state 누출 우려 시 `afterEach(() => __resetDriver())` 등록

봇 명령 테스트 추가 시:
- 현재 인프라 없음. interaction mock 빌더 필요 (Wave 5.4 보류 항목)
- 우선 pure 함수 (utils/) 위주로 테스트 추가 가능
