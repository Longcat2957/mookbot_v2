# Testing — `packages/core` (14 파일 / 144 tests)

각 테스트 파일이 무엇을 검증하는지. describe 블록 단위 요약. it 케이스는 코드 가독성으로 충분 — 여기서 모두 나열하지 않음.

| 파일 | tests | 카테고리 |
|---|---|---|
| [`mmr/elo.test.ts`](#mmrelotest-ts) | 15 | pure |
| [`riot/account.test.ts`](#riotaccounttest-ts) | 9 | pure |
| [`db/recruitments.test.ts`](#dbrecruitmentstest-ts) | 11 | DB |
| [`db/series.test.ts`](#dbseriestest-ts) | 13 | DB |
| [`db/seasons.test.ts`](#dbseasonstest-ts) | 4 | DB |
| [`db/users.test.ts`](#dbuserstest-ts) | 18 | DB |
| [`db/admin.test.ts`](#dbadmintest-ts) | 12 | DB |
| [`db/record.test.ts`](#dbrecordtest-ts) | 9 | DB |
| [`db/games.test.ts`](#dbgamestest-ts) | 6 | DB |
| [`db/kv.test.ts`](#dbkvtest-ts) | 7 | DB |
| [`db/picks.test.ts`](#dbpickstest-ts) | 12 | DB |
| [`db/mmr.test.ts`](#dbmmrtest-ts) | 8 | DB |
| [`db/sql.test.ts`](#dbsqltest-ts) | 7 | pure |

---

## `mmr/elo.test.ts`

**대상**: `packages/core/src/mmr/elo.ts` — ELO MMR 계산 (pure 함수).

**describe 블록**:
- **expectedScore** (4) — 동등/400 격차/대칭성. 표준 ELO 공식 검증.
- **updateElo** (6) — 승/패 + delta, K factor override, zero-sum invariant.
- **applyGameElo** (5) — 한 게임 5라인 일괄 ELO 적용. role 순서/userId 매핑 보존, sum-zero invariant.

**핵심**: K=32, 동등 MMR 승자 +16/패자 -16. 라인 매치업 단위로 ELO 적용 (5라인 시 5쌍).

---

## `riot/account.test.ts`

**대상**: `packages/core/src/riot/account.ts` — `parseRiotId` (pure 함수).

**describe 블록**:
- **parseRiotId** (9) — `"GameName#TagLine"` 파싱.

**케이스**: ASCII / 공백 / 유니코드 / 다중 # (첫 # 기준 split) / 빈 문자열 + 형식 오류는 throw.

---

## `db/recruitments.test.ts`

**대상**: `packages/core/src/db/recruitments.ts` — 모집 라이프사이클.

**describe 블록**:
- **recruitments — round-trip** (3) — create + get + listOpen 의 status 필터.
- **recruitments — participants** (2) — add/list/isParticipant/remove + setRecruitmentRoles overwrite.
- **recruitments — message tracking + lists + delete** (5) — setRecruitmentMessage / listCancellable / listBuildable / listStaleOpenRecruitments / deleteRecruitment cascade.

**핵심**: 모집 status 전이 (OPEN/CLOSED/CONVERTED/CANCELLED), 참가자 라인 선호 갱신, 삭제 시 CASCADE.

---

## `db/series.test.ts`

**대상**: `packages/core/src/db/series.ts` — 시리즈 생성 + status 전이.

**describe 블록**:
- **createSeries** (6) — happy 2v2 + 4 종류 검증 실패 (홀수 / 팀 크기 / 라인 중복 x2 / 매치업 없음).
- **status transitions** (3) — completeSeries (winning_team + ended_at), no-op on non-IN_PROGRESS, cancelSeries.
- **listing** (2) — listAllOpenSeries (status 필터), listStaleOpenSeries (cutoff).
- **deleteSeriesPhysical** (1) — CASCADE 검증.
- **setSeriesMessage / listOpenSeriesByUser / listRecentSeriesForUser** (3) — 메시지 트래킹 + 사용자별 필터링.

**핵심**: 1v1~5v5 검증 (참가자 짝수 + 팀 크기 일치 + 라인 매치업 가능), Bo3 종료 후 status 변화.

---

## `db/seasons.test.ts`

**대상**: `packages/core/src/db/seasons.ts` — 시즌 lifecycle.

**describe 블록**:
- **seasons** (4) — create + getSeason / getCurrentSeason 가 ended_at IS NULL 만 + endSeason idempotent.

**핵심**: 단일 시즌 자동 생성 + endSeason 후 다음 시즌 시작 가능.

---

## `db/users.test.ts`

**대상**: `packages/core/src/db/users.ts` — 사용자 + Riot 계정.

**describe 블록**:
- **upsertUser** (6) — INSERT / UPDATE (display_name 다른 경우만) / no-op (같은 displayName) / getUser undefined / listUsers IN clause + 빈 배열.
- **linkRiotAccount** (4) — main 으로 저장 / 두 번째 link 가 main 강등 / setMain=false 유지 / 같은 puuid UPSERT 갱신.
- **riot account 추가 조회** (4) — getRiotAccountsByUser (main first 정렬) / listMainRiotAccounts 다건 + 빈 배열 / getRiotAccountByPuuid + getUserByPuuid.
- **upsertRiotAccountIdentity / setMainRiotAccount** (4) — 신규 is_main=0 / 기존 is_main 보존 / 메인 토글 / **존재하지 않는 puuid 면 main 사라짐 (현재 구현 quirk — JSDoc 와 다름)**.

**핵심**: Riot 계정 main 승격 / 강등 + identity-only upsert. 마지막 case 는 발견된 prod 동작 (별도 PR 후보로 명시됨).

---

## `db/admin.test.ts`

**대상**: `packages/core/src/db/admin.ts` — 운영자 admin 작업.

**describe 블록**:
- **recordAudit** (2) — payload JSON 직렬화 + optional 필드 NULL.
- **adjustLaneMmr** (4) — baseline 1500 + delta / 누적 / 음수 / 라인별 독립.
- **inspectSeasonForReset** (2) — 빈 시즌 0 카운트 / lane MMR 반영.
- **resetSeasonData** (1) — 시즌 데이터 일괄 삭제.
- **inspectSeriesForDelete + forceDeleteSeriesWithRollback** (3) — counts/rollbackPlan 집계 + rollback true (MMR 차감) / false (MMR 유지) 양쪽.

**핵심**: 운영자 강제 작업이 audit 로그 + MMR 정확 반영.

---

## `db/record.test.ts`

**대상**: `packages/core/src/db/record.ts` — `recordGameAndUpdateMmr` + `undoLastGame`.

**describe 블록**:
- **recordGameAndUpdateMmr** (4) — happy (game/mmr_changes/lane_mmr 갱신) / 연속 2 게임 누적 / 참가자 없음 / no active season.
- **undoLastGame** (5) — MMR 차감 + 게임 삭제 / COMPLETED → IN_PROGRESS 복구 / 시리즈 없음 / 게임 없음 / CANCELLED 시리즈 거부.

**핵심**: 게임 1개 = `games + game_stats + mmr_changes + user_lane_mmr` 4 테이블 일괄 INSERT/UPSERT. undo 는 역방향 + status 복구.

---

## `db/games.test.ts`

**대상**: `packages/core/src/db/games.ts` — 게임 row 조회.

**describe 블록**:
- **getGame / listGamesInSeries** (3) — get + game_number 정렬 + 빈 시리즈.
- **getGameStats** (1) — game_stats row 들 반환.
- **countSeriesWins** (2) — 0:0 / 2:1 집계.

**핵심**: `INSERT INTO games` 직접 + 헬퍼들이 정확히 fetch.

---

## `db/kv.test.ts`

**대상**: `packages/core/src/db/kv.ts` — guild_kv (drag/draft 보관용 K-V).

**describe 블록**:
- **guild_kv** (7) — get/set/delete + UPSERT 갱신 + updatedBy 추적 + delete unknown key no-error.

**핵심**: pickban draft / entry draft 같은 임시 JSON 보관에 사용. UPSERT 패턴.

---

## `db/picks.test.ts`

**대상**: `packages/core/src/db/picks.ts` — 게임별 픽/밴 + Hard Fearless.

**describe 블록**:
- **setGamePicks / getGamePicks** (3) — set+get round-trip / 기존 교체 / 빈 배열 모두 삭제.
- **setGameBans / getGameBans** (2) — position 보존 / 빈 배열.
- **getSeriesUsedChampions / validateFearless** (5) — 두 게임 합산 / excludeGameId / 이전 게임 위반 / 입력 자체 중복 / 통과.
- **getSeriesPicksAndBans** (1) — Bo3 통합 game_number 순 정렬.

**핵심**: 시리즈 내 hard fearless (한 챔프 시리즈 내 1회) 검증 로직.

---

## `db/mmr.test.ts`

**대상**: `packages/core/src/db/mmr.ts` — MMR 조회 (leaderboard / changes).

**describe 블록**:
- **getLaneMmrs** (2) — 다건 (user, role) 페어 lookup / 빈 입력.
- **getLeaderboard / countLeaderboard** (3) — MMR DESC + games_played > 0 필터 / limit/offset / count.
- **getMmrChangesForUser / getMmrChangesForGame** (2) — 사용자별 / 게임별 변동 row.

**핵심**: 시즌별 라인별 leaderboard, MMR 변동 이력.

---

## `db/sql.test.ts`

**대상**: `packages/core/src/db/sql.ts` — SQL helper (multiInsert / inClause).

**describe 블록**:
- **multiInsert** (4) — 기본 동작 / 빈 rows throw / row length 불일치 throw / 1 row.
- **inClause** (3) — 정상 / 빈 배열 → `(NULL)` / 1 value.

**핵심**: 다건 INSERT SQL 빌더 + IN 절 placeholder 빌더.
