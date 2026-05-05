-- ============================================================
-- 내전 트래킹 DB 스키마 (Cloudflare D1 / SQLite)
-- ============================================================
-- 설계 전제:
--   - Bo3 시리즈, 라인은 시리즈 내내 고정 (게임 간 스왑 없음)
--   - MMR 부여 단위: 게임 단위 (라인 매치업 기반 ELO)
--   - 매치 데이터는 운영자 수동 기록 (Match-V5 자동연동은 추후)
-- ============================================================


-- ============================================================
-- Users & Riot Accounts
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    discord_id    TEXT    PRIMARY KEY,
    display_name  TEXT    NOT NULL,
    created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS riot_accounts (
    puuid       TEXT    PRIMARY KEY,
    user_id     TEXT    NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
    game_name   TEXT    NOT NULL,
    tag_line    TEXT    NOT NULL,
    is_main     INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_riot_accounts_user ON riot_accounts(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_riot_accounts_riot_id ON riot_accounts(game_name, tag_line);


-- ============================================================
-- Seasons
-- ============================================================

CREATE TABLE IF NOT EXISTS seasons (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    started_at  INTEGER NOT NULL,
    ended_at    INTEGER,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);


-- ============================================================
-- Series (Bo3) & Participants
-- ============================================================

-- series.id 는 createSeries 호출 시 명시적으로 전달 — 모집 ID 와 동일하게 부여한다.
-- AUTOINCREMENT 는 fallback (seed / 명시 id 미지정 호출) 용. 운영 흐름은 항상 명시 id 사용.
CREATE TABLE IF NOT EXISTS series (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id     INTEGER NOT NULL REFERENCES seasons(id),
    status        TEXT    NOT NULL DEFAULT 'IN_PROGRESS',
    winning_team  TEXT,
    started_at    INTEGER NOT NULL DEFAULT (unixepoch()),
    ended_at      INTEGER,
    created_by    TEXT    REFERENCES users(discord_id),
    channel_id            TEXT,                  -- (deprecated, v2: 컨트롤 메시지 라이프사이클 제거)
    message_id            TEXT,                  -- (deprecated, v2)
    activity_instance_id  TEXT,                  -- v2: Discord Activity instance
    activity_started_at   INTEGER,               -- v2
    end_card_message_id   TEXT,                  -- v2: 종료 카드 (영속 기록)
    end_card_channel_id   TEXT,                  -- v2
    deleted_at            INTEGER,               -- v3: soft-delete (NULL = live). 모든 read 쿼리는 IS NULL 필터.
    CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    CHECK (winning_team IS NULL OR winning_team IN ('TEAM_1', 'TEAM_2'))
);

CREATE INDEX IF NOT EXISTS idx_series_season ON series(season_id);
CREATE INDEX IF NOT EXISTS idx_series_status ON series(status);
-- idx_series_deleted_at: 기존 DB 에 ALTER 로 컬럼 추가된 뒤 만들어야 하므로 파일 끝 ALTER 블록에 위치.

CREATE TABLE IF NOT EXISTS series_participants (
    series_id  INTEGER NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    user_id    TEXT    NOT NULL REFERENCES users(discord_id),
    team       TEXT    NOT NULL,
    role       TEXT    NOT NULL,
    PRIMARY KEY (series_id, user_id),
    CHECK (team IN ('TEAM_1', 'TEAM_2')),
    CHECK (role IN ('TOP', 'JUNGLE', 'MID', 'BOTTOM', 'SUPPORT'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sp_team_role ON series_participants(series_id, team, role);
CREATE INDEX IF NOT EXISTS idx_sp_user ON series_participants(user_id);


-- ============================================================
-- Games (Bo3 내 개별 게임 1~3) & Stats
-- ============================================================

CREATE TABLE IF NOT EXISTS games (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    series_id     INTEGER NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    game_number   INTEGER NOT NULL,
    winning_team  TEXT    NOT NULL,
    team1_side    TEXT    NOT NULL,
    duration_sec  INTEGER,
    riot_match_id TEXT    UNIQUE,
    played_at     INTEGER NOT NULL DEFAULT (unixepoch()),
    CHECK (game_number BETWEEN 1 AND 3),
    CHECK (winning_team IN ('TEAM_1', 'TEAM_2')),
    CHECK (team1_side IN ('BLUE', 'RED')),
    UNIQUE (series_id, game_number)
);

CREATE INDEX IF NOT EXISTS idx_games_series ON games(series_id);

CREATE TABLE IF NOT EXISTS game_stats (
    game_id      INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id      TEXT    NOT NULL REFERENCES users(discord_id),
    team         TEXT    NOT NULL,
    role         TEXT    NOT NULL,
    champion_id  INTEGER,
    kills        INTEGER NOT NULL DEFAULT 0,
    deaths       INTEGER NOT NULL DEFAULT 0,
    assists      INTEGER NOT NULL DEFAULT 0,
    cs           INTEGER NOT NULL DEFAULT 0,
    won          INTEGER NOT NULL,
    PRIMARY KEY (game_id, user_id),
    CHECK (team IN ('TEAM_1', 'TEAM_2')),
    CHECK (role IN ('TOP', 'JUNGLE', 'MID', 'BOTTOM', 'SUPPORT')),
    CHECK (won IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_gs_user ON game_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_gs_user_role ON game_stats(user_id, role);
CREATE INDEX IF NOT EXISTS idx_gs_user_champion ON game_stats(user_id, champion_id);


-- ============================================================
-- MMR (라인별, 시즌별)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_lane_mmr (
    user_id       TEXT    NOT NULL REFERENCES users(discord_id),
    season_id     INTEGER NOT NULL REFERENCES seasons(id),
    role          TEXT    NOT NULL,
    mmr           REAL    NOT NULL DEFAULT 1500,
    games_played  INTEGER NOT NULL DEFAULT 0,
    wins          INTEGER NOT NULL DEFAULT 0,
    updated_at    INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (user_id, season_id, role),
    CHECK (role IN ('TOP', 'JUNGLE', 'MID', 'BOTTOM', 'SUPPORT'))
);

CREATE INDEX IF NOT EXISTS idx_lane_mmr_leaderboard ON user_lane_mmr(season_id, role, mmr DESC);

CREATE TABLE IF NOT EXISTS mmr_changes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id      INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    user_id      TEXT    NOT NULL REFERENCES users(discord_id),
    season_id    INTEGER NOT NULL REFERENCES seasons(id),
    role         TEXT    NOT NULL,
    opponent_id  TEXT    NOT NULL REFERENCES users(discord_id),
    mmr_before   REAL    NOT NULL,
    mmr_after    REAL    NOT NULL,
    delta        REAL    NOT NULL,
    created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_mmr_changes_user ON mmr_changes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mmr_changes_game ON mmr_changes(game_id);


-- ============================================================
-- Recruitments (내전 모집 풀) & Participants
-- ============================================================

CREATE TABLE IF NOT EXISTS recruitments (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id             INTEGER NOT NULL REFERENCES seasons(id),
    target_count          INTEGER NOT NULL DEFAULT 10,
    status                TEXT    NOT NULL DEFAULT 'OPEN',
    converted_series_id   INTEGER REFERENCES series(id),
    created_by            TEXT    NOT NULL REFERENCES users(discord_id),
    channel_id            TEXT,
    message_id            TEXT,
    created_at            INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at            INTEGER NOT NULL DEFAULT (unixepoch()),
    CHECK (status IN ('OPEN', 'CLOSED', 'CONVERTED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_recruitments_status ON recruitments(status);
CREATE INDEX IF NOT EXISTS idx_recruitments_creator ON recruitments(created_by);

CREATE TABLE IF NOT EXISTS recruitment_participants (
    recruitment_id INTEGER NOT NULL REFERENCES recruitments(id) ON DELETE CASCADE,
    user_id        TEXT    NOT NULL REFERENCES users(discord_id),
    joined_at      INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (recruitment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_rp_user ON recruitment_participants(user_id);


-- ============================================================
-- Admin Audit Log
-- ============================================================
-- 운영자 admin 명령 (강제삭제·MMR수정·시즌리셋·일괄정리 등) 실행 기록.
-- 데이터 사고 추적 + 책임 소재 명확화.

CREATE TABLE IF NOT EXISTS admin_audit_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    operator_id  TEXT    NOT NULL,
    action       TEXT    NOT NULL,
    target_type  TEXT,
    target_id    TEXT,
    payload      TEXT,
    note         TEXT,
    created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_audit_operator ON admin_audit_log(operator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON admin_audit_log(action, created_at DESC);


-- ============================================================
-- 길드 설정 (key-value, 규칙 등 자유 텍스트 저장용)
-- ============================================================

CREATE TABLE IF NOT EXISTS guild_kv (
    k          TEXT    PRIMARY KEY,
    v          TEXT    NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_by TEXT
);


-- 한 참가자가 여러 라인을 선호로 등록할 수 있음 (0개도 가능 = 라인 무관)
CREATE TABLE IF NOT EXISTS recruitment_participant_roles (
    recruitment_id INTEGER NOT NULL,
    user_id        TEXT    NOT NULL,
    role           TEXT    NOT NULL,
    PRIMARY KEY (recruitment_id, user_id, role),
    CHECK (role IN ('TOP','JUNGLE','MID','BOTTOM','SUPPORT')),
    FOREIGN KEY (recruitment_id, user_id)
        REFERENCES recruitment_participants(recruitment_id, user_id) ON DELETE CASCADE
);

-- ============================================================
-- 게임별 픽/밴 (선택 입력 — 결과기록 후 [픽밴 입력] 모달에서 작성)
-- ============================================================

-- 한 게임의 픽 = 팀 × 라인 별 1챔프. 5라인 × 2팀 = 10행 max.
CREATE TABLE IF NOT EXISTS game_picks (
    game_id        INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    team           TEXT    NOT NULL,
    role           TEXT    NOT NULL,
    champion_name  TEXT    NOT NULL,
    PRIMARY KEY (game_id, team, role),
    CHECK (team IN ('TEAM_1', 'TEAM_2')),
    CHECK (role IN ('TOP','JUNGLE','MID','BOTTOM','SUPPORT'))
);

CREATE INDEX IF NOT EXISTS idx_game_picks_game ON game_picks(game_id);

-- 한 게임의 밴 = 팀 × 순서별. 솔랭 5밴 × 2팀 = 10행 max.
CREATE TABLE IF NOT EXISTS game_bans (
    game_id        INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    team           TEXT    NOT NULL,
    position       INTEGER NOT NULL,
    champion_name  TEXT    NOT NULL,
    PRIMARY KEY (game_id, team, position),
    CHECK (team IN ('TEAM_1', 'TEAM_2')),
    CHECK (position BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_game_bans_game ON game_bans(game_id);


-- ============================================================
-- 사용자 라인별 선호 챔피언 (게시판 텍스트 대체)
-- ============================================================
-- 본인이 자기 라인별로 선호하는 챔프 풀을 등록 (게시판에 텍스트로 짜치게 적던 것을 페이지로).
-- position = 사용자 입력 순서. 라인당 챔프 최대 개수는 애플리케이션 레이어에서 검증.
CREATE TABLE IF NOT EXISTS user_champion_preferences (
    user_id      TEXT    NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
    role         TEXT    NOT NULL,
    champion_id  INTEGER NOT NULL,
    position     INTEGER NOT NULL,
    PRIMARY KEY (user_id, role, champion_id),
    CHECK (role IN ('TOP','JUNGLE','MID','BOTTOM','SUPPORT'))
);

CREATE INDEX IF NOT EXISTS idx_ucp_user_role ON user_champion_preferences(user_id, role, position);


-- ============================================================
-- Idempotent ALTER TABLE migrations (existing DB 보강용)
-- ============================================================
-- 신규 DB 는 위쪽 CREATE TABLE 에 컬럼이 이미 포함되므로 아래는 no-op.
-- 기존 DB 는 한 번만 적용되며, migrate.ts 가 "duplicate column" 에러를
-- 멱등으로 흡수한다.

-- v0.7: series 컨트롤 메시지 추적 (한 시리즈 = 한 메시지) — v2 에서 deprecated
ALTER TABLE series ADD COLUMN channel_id TEXT;
ALTER TABLE series ADD COLUMN message_id TEXT;

-- v2: Activity 세션 추적 + 종료 카드 영속 기록
ALTER TABLE series ADD COLUMN activity_instance_id TEXT;
ALTER TABLE series ADD COLUMN activity_started_at INTEGER;
ALTER TABLE series ADD COLUMN end_card_message_id TEXT;
ALTER TABLE series ADD COLUMN end_card_channel_id TEXT;

-- v3: soft-delete. revert / cleanup-stale / force-delete / season-reset 가 모두 UPDATE deleted_at = unixepoch().
-- 모든 read 쿼리는 deleted_at IS NULL 필터. 진짜 삭제는 별도 purge (관리자 수동) 로 분리.
ALTER TABLE series ADD COLUMN deleted_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_series_deleted_at ON series(deleted_at);
