# mookbot v2 — Embedded App SDK 전면 리팩토링 기획서

> **상태**: v0.1.1 — Phase 0~3 완료, 실서비스 가능 단계. Phase 4 (운영 안정화) 진행 중.
> **선행 산출물**: `myDiscordBot` (v0.7, discord.js + satori PNG 기반)
> **목적**: 채널 메시지 edit 기반 UI의 latency / refresh 병목을 근본 해결.
> **수단**: Discord Embedded App SDK (Activity) 전면 채택. 봇은 진입점·영속 기록 발행자로 슬림화.
> **도메인**: `bot.mooklol.com` (Cloudflare proxied, single-host path-based routing).
> **Repo**: https://github.com/Longcat2957/mookbot_v2 (private)

---

## 1. 배경 — 왜 v2 인가

### 1.1 v1 (myDiscordBot) 의 latency 사슬

버튼 1회 클릭 → 카드 갱신까지 **0.7~1.5s**가 정상 경로. 픽/밴·수동배정처럼 인접 입력이 몰리면 rate limit 큐잉으로 더 늘어남.

| 단계 | 비용 | 빈도 |
|---|---|---|
| Interaction defer (`deferReply`) | ~100ms RTT | 모든 버튼/슬래시 |
| satori → resvg PNG (1280×720급) | 150~400ms CPU | 매 카드 갱신 |
| Discord `editReply` / `messages.edit` | 200~500ms RTT + rate limit | 매 상태 변화 |
| 클라이언트 fan-out (참가자 fetch) | 가변, 모바일 1~2s | 매 edit |
| `MediaGallery` 첨부 PNG 재업로드 | 200~500ms | PNG 바뀔 때마다 |
| Interaction Token 만료 | 15분 | 시리즈 1회당 1~수회 |

**근본 원인**: 모든 상태 변화가 Discord API를 왕복해야 하고, 결과는 PNG 첨부로 fan-out 됨.

### 1.2 satori 제거나 V2 native 마이그레이션으로는 안 풀림

- satori 만 빼도 Discord edit RTT + 첨부 fan-out + token 만료가 남음.
- V2 native 컴포넌트는 grid/2-column/임의 레이아웃 불가 → 정보밀도 후퇴.
- → **Discord API 왕복 자체를 회피**해야 풀린다 = Activity.

### 1.3 Activity 채택 시 변하는 것

- 클라이언트 ↔ 자체 백엔드 WebSocket: **<50ms**, rate limit 없음
- 상태 변화는 로컬 React 렌더: **<16ms**
- PNG 없음, 첨부 없음, Discord API 갱신 없음
- 토큰 만료 개념 없음 (Activity 세션 동안)
- **목표 latency**: 버튼 → UI 갱신 **<50ms** (현재 대비 14~30×)

---

## 2. 범위 — 시리즈 라이프사이클 4단계

### 2.0 핵심 원칙

**Bot** = 채널 공개·캐주얼·1회성 입력. 모든 참가자가 같은 채널에서 본다. 출력은 **텍스트 only** (Discord embed 또는 Components V2 `TextDisplay/Section`). **satori / PNG 렌더링 사용 안 함**.

**Activity** = 운영자(밸런스 담당자) 파워툴 + 참가자 read-only 대기실. Data Dragon 자산을 활용한 시각적 UI. UI 라이브러리: **daisyUI (Tailwind v4 위)**.

### 2.1 시리즈 라이프사이클

```
[1] 모집                Bot       채널 메시지   참석 등록 + 라인 선호
     │
     │ 정원 도달 → 담당자에게 [엔트리 수정 시작] 버튼
     ▼
[2] 엔트리 수정         Activity  담당자 입력   드래그&드롭 슬롯 보드
     │                                          + 시리즈 객체 D1 INSERT (status=ENTRY_EDITING)
     │ 담당자 [엔트리 제출]
     ▼
[3] 대기실              Activity  참가자 read-only   확정 엔트리 확인
     │                                                + 시작 대기
     │ 담당자 [내전 시작]
     ▼
[4] 픽/밴 + 결과        Activity  담당자 입력   DD 챔프 그리드/검색
                                  참가자 read-only   사이드/스코어/되돌리기
     │
     │ 시리즈 종료
     ▼
   Bot 채널 종료 알림 (텍스트 요약)
```

### 2.2 기능 매트릭스

| 기능 | Bot | Activity | 비고 |
|---|---|---|---|
| **[1] 모집** |  |  |  |
| 채널 모집 메시지 + 참석 등록 / 라인 선호 | ✅ |  | push 알림, 모든 참가자 접근 |
| 정원 도달 → 담당자에게 [엔트리 수정] 버튼 | ✅ |  | 권한 검사 |
| **[2] 엔트리 수정 (담당자)** |  |  |  |
| 시리즈 객체 D1 INSERT (status=`ENTRY_EDITING`) |  | ✅ | Activity 진입 즉시 |
| 후보 풀 (라인 선호 + MMR) 시각화 |  | ✅ |  |
| 자동 분배 추천 |  | ✅ | MMR/선호 기반 1-click |
| 수동 슬롯 배정 (드래그&드롭) |  | ✅ |  |
| 엔트리 제출 → status=`READY` |  | ✅ |  |
| **[3] 대기실 (참가자)** |  |  |  |
| 확정 엔트리 read-only (BLUE/RED 라인업) |  | ✅ |  |
| 담당자의 [내전 시작] 대기 |  | ✅ |  |
| **[4] 픽/밴 + 결과** |  |  |  |
| 챔프 그리드 / 검색 (DD 아이콘) |  | ✅ | DD 사용 필수 |
| 픽/밴 입력 (담당자) |  | ✅ |  |
| Hard Fearless 즉시 검증 |  | ✅ |  |
| 사이드 픽커, 결과 입력, 되돌리기, 취소 |  | ✅ |  |
| **채널 알림 (텍스트)** |  |  |  |
| 모집 종료 / 시리즈 생성 / 시작 / 종료 요약 | ✅ |  | embed 또는 V2 TextDisplay |
| (선택) 게임별 결과 한 줄 요약 | ✅ |  |  |
| **계정 / 등록** |  |  |  |
| `/등록`, `/일괄등록`, `/내정보` | ✅ |  | 1회성 슬래시 |
| **read-only 조회** |  |  |  |
| `/내전기록`, `/랭킹`, `/전적`, `/지금게임` | ✅ |  | 텍스트 (마크다운 표 / 코드블록) |
| **운영자 admin** |  |  |  |
| `/시리즈강제삭제`, `/MMR수정`, `/시즌결과리셋`, `/오래된내전정리` | ✅ |  | 빈도 낮음 |

### 2.3 핵심 변경 사항 (이전 PLAN과 차이)

1. **satori / resvg / react 의존성 봇에서 완전 제거** — `apps/bot/package.json`에서 `satori`, `@resvg/resvg-js`, `react` 삭제. 폰트 디렉토리 폐기. v1의 `services/render/templates/*.tsx` 9개 모두 폐기 (이식 안 함).
2. **시리즈 객체 INSERT 시점 = 담당자 Activity 진입 시점** — 모집은 일종의 사전 단계, 시리즈 row는 [2] 엔트리 수정에 들어가는 순간 생성.
3. **"엔트리 수정" / "대기실" 단계 신설** — `RECRUITING → ENTRY_EDITING → READY → IN_GAME → COMPLETED` (`CANCELLED` 분기).
4. **봇 출력 = 텍스트 only** — 채널 알림은 Discord embed 또는 V2 TextDisplay. 종료 카드도 텍스트 요약 (3게임 픽밴/MMR 변동을 마크다운 표로).

### 2.4 진입점 (슬래시)

| 슬래시 | 단계 | 비고 |
|---|---|---|
| `/내전모집` | [1] | 모집 메시지 게시. 정원/제목 옵션 |
| `/내전` | [2] 진입 | 담당자만. 모집 정원 도달 후 버튼/슬래시로 Activity launch |
| `/내전 join <id>` | [3]/[4] | 진행 중 시리즈 재합류 |
| `/내전기록`, `/랭킹`, `/전적`, `/지금게임` | — | read-only 조회 |
| `/등록`, `/일괄등록`, `/내정보` | — | 계정 |
| 운영자 admin | — | 별도 슬래시 그룹 |

---

## 3. 아키텍처

```
┌───────────────────────────────────────────────────────────────┐
│  Discord Client (web / desktop / mobile)                       │
│                                                                 │
│   ┌──────────────────────────┐    ┌─────────────────────────┐  │
│   │ 채널 메시지              │    │ Activity (iframe SPA)    │  │
│   │  - /내전 진입 버튼       │    │  - React + Embedded SDK  │  │
│   │  - 시리즈 종료 PNG       │    │  - 픽/밴, 배정, 결과     │  │
│   │  - /랭킹, /전적 등 PNG   │    │                          │  │
│   └──────────┬───────────────┘    └────────┬─────────────────┘  │
│              │                             │                     │
└──────────────┼─────────────────────────────┼─────────────────────┘
               │ Discord Gateway/REST        │ HTTPS + WSS
               ▼                             ▼
   ┌──────────────────────┐    ┌──────────────────────────────┐
   │ Bot (apps/bot)       │    │ Activity Backend (apps/api)  │
   │  - discord.js v14    │    │  - Fastify + ws              │
   │  - 슬래시 진입점     │    │  - REST + WebSocket          │
   │  - satori 종료 카드  │    │  - OAuth2 토큰 검증          │
   │  - read-only 카드    │    │  - 세션 / 시리즈 권한        │
   └──────┬───────────────┘    └──────┬───────────────────────┘
          │                            │
          │  내부 HTTP (시리즈 종료    │
          │   webhook → 종료 카드)     │
          └────────────┬───────────────┘
                       │
                       ▼
            ┌──────────────────────────┐
            │ packages/core (공유)     │
            │  - services/db (D1)      │
            │  - services/riot         │
            │  - services/mmr          │
            │  - services/datadragon   │
            └──────────┬───────────────┘
                       │
            ┌──────────┴───────────────┐
            │                          │
            ▼                          ▼
       Cloudflare D1            Riot Games API
```

### 3.1 모노레포 레이아웃 (pnpm workspace)

```
mookbot_v2/
├── pnpm-workspace.yaml
├── package.json
├── PLAN.md                        # this file
├── README.md
├── apps/
│   ├── bot/                       # discord.js — 진입점 + 영속 카드 발행
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── commands/          # 슬래시 (대폭 축소)
│   │   │   ├── render/            # satori (read-only + 종료 카드만)
│   │   │   └── webhooks/          # api → bot 시리즈 종료 알림
│   │   └── package.json
│   ├── api/                       # Activity 백엔드 (Fastify + ws)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── auth/              # OAuth2 토큰 검증, 세션
│   │   │   ├── http/              # REST endpoints
│   │   │   ├── ws/                # WebSocket — 시리즈 룸
│   │   │   ├── domain/            # 시리즈 상태기계
│   │   │   └── webhooks/          # → bot
│   │   └── package.json
│   └── activity/                  # React SPA (Vite)
│       ├── src/
│       │   ├── main.tsx
│       │   ├── sdk/               # @discord/embedded-app-sdk wiring
│       │   ├── api/               # WS / REST 클라이언트
│       │   ├── screens/           # 모집 / 픽밴 / 결과
│       │   ├── components/        # 디자인 시스템
│       │   └── state/             # Zustand or Jotai
│       ├── index.html
│       └── vite.config.ts
└── packages/
    └── core/                      # v1 services 추출
        └── src/
            ├── db/
            ├── riot/
            ├── mmr/
            └── datadragon/
```

---

## 4. HTTPS 운영 (호스팅·도메인·인증서·CSP)

Activity는 **HTTPS 필수** (Discord 클라이언트가 iframe 로드 시 mixed content 차단). 신규 운영 항목.

### 4.1 도메인 — **확정**: `bot.mooklol.com` 단일 호스트 + path-based routing

Cloudflare DNS:
- `A bot → 141.164.46.191` (Proxied = orange cloud)
- Cloudflare Edge에서 자동으로 `https → http(80)` 처리 → Origin은 80만 listen
- TLS 인증서는 Cloudflare가 관리 (Origin Cert 또는 Universal SSL)

서브도메인을 분리하지 않는 이유:
- **Discord URL Mapping**도 path prefix 기반이므로 단일 호스트가 자연스러움
- Cloudflare/TLS 관리 단순화
- 동일 출처(same-origin) 정책으로 cookie/CSP 부담 감소

Path 분배 (nginx에서 분기):

| Path | 백엔드 | 비고 |
|---|---|---|
| `/` | `apps/activity` (정적 SPA) | Discord 클라이언트가 iframe 로드 |
| `/api/*` | `apps/api` REST | OAuth2 세션, 시리즈 액션 |
| `/ws` | `apps/api` WebSocket | upgrade 헤더 처리 |
| `/dd/*` | `ddragon.leagueoflegends.com` | 외부 fetch는 Discord URL Mapping 경유 (§4.3) |
| `/healthz` | nginx 인라인 200 | 외부 모니터링 |

봇(`apps/bot`)은 outbound only → 도메인 불필요.

### 4.2 TLS 인증서

- **Cloudflare Universal SSL** 사용 (현재 활성 상태). Edge ↔ 클라이언트는 Cloudflare가 처리.
- Origin (VPS) ↔ Cloudflare 구간:
  - 1차: **Flexible** (Cloudflare → Origin이 http) — 현재 설정. nginx 80만 listen.
  - 2차 (강화 시): **Full (strict)** + Cloudflare Origin Certificate 발급 + nginx 443 listen. WSS 안정성·헤더 신뢰성 측면에서 Phase 1 진입 시 전환 권장.
- WSS (`wss://`)는 클라이언트 → Cloudflare Edge에서 종단, Edge → Origin은 평문 ws (Flexible) 또는 wss (Full strict). Cloudflare WebSocket 지원은 기본 활성.

### 4.3 Discord URL Mapping

Activity는 iframe 안에서 외부 URL 직접 fetch 불가 — Discord proxy 를 거쳐야 함.
**Developer Portal → Activities → URL Mappings** (Root Mapping 단일 호스트):

| Prefix | Target |
|---|---|
| `/` (Root) | `bot.mooklol.com` |
| `/dd` | `ddragon.leagueoflegends.com` (챔피언 아이콘 등 외부) |

Root Mapping이 `bot.mooklol.com`이면 Activity 안의 `fetch("/api/...")`, `new WebSocket("/ws")`가 모두 `bot.mooklol.com`로 프록시됨. nginx가 path로 `apps/api`, `apps/activity`에 분배.

### 4.4 CSP / 보안 헤더

Activity iframe 내부는 sandboxed. nginx 또는 백엔드 응답에 다음 헤더 필수:

```
Content-Security-Policy:
  default-src 'self' https://*.discord.com https://*.discordapp.com;
  connect-src 'self' wss://bot.mooklol.com https://*.discord.com;
  img-src 'self' data: https://ddragon.leagueoflegends.com https://*.discordapp.com;
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  frame-ancestors https://discord.com https://*.discord.com;
X-Frame-Options:        # frame-ancestors 사용 시 생략 (충돌)
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: no-referrer
```

`frame-ancestors`로 Discord 외 도메인의 iframe 임베드 차단.

### 4.5 호스팅 — **확정**: 현재 VPS + nginx (Docker)

`141.164.46.191` (Vultr) VPS, `~/deploy/docker-compose.yml` 단일 stack:

```yaml
services:
  mookbot:    # v1 봇 (Phase 3에서 apps/bot으로 교체)
    image: longcat1132/mookbot:latest
    ...
  nginx:      # ✅ 구축 완료 (2026-04-30)
    image: nginx:1.27-alpine
    ports: ["80:80"]
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
  # === Phase 1+ 추가 예정 ===
  # api:      # apps/api (Fastify + ws)
  #   build: ../mookbot_v2/apps/api
  #   expose: ["3000"]
  # activity: # apps/activity (Vite preview 또는 nginx static)
  #   build: ../mookbot_v2/apps/activity
  #   expose: ["5173"]
```

nginx 컨테이너가 host network namespace의 80포트를 점유. `api`, `activity`는 동일 compose 네트워크에서 컨테이너명으로 접근 (`http://api:3000`, `http://activity:5173`).

대안 (보류):
- Cloudflare Pages로 SPA만 분리 — 트래픽 증가 시 재검토
- Cloudflare Workers + DO로 풀 엣지 — Riot API/D1 fetch 제약 검토 필요

### 4.6 OAuth2 / 인증 흐름

1. 사용자가 Activity 진입 → Discord 클라이언트가 SPA를 `bot.mooklol.com/`에서 iframe으로 로드.
2. SPA → `embedded-app-sdk.commands.authorize({ scope: ['identify', 'guilds.members.read'] })` → access_token.
3. SPA → `POST /api/session` (access_token 동봉) → 백엔드가 `discord.com/api/users/@me`로 토큰 검증 → 자체 세션 쿠키 (HttpOnly, SameSite=None, Secure, Domain=bot.mooklol.com).
4. WS 핸드셰이크 (`wss://bot.mooklol.com/ws`) 시 쿠키로 인증 (same-origin이므로 자동 첨부).
5. 백엔드는 `users.discord_id` 매핑으로 v1 권한 모델과 연결.

**필요 scope**: `identify` (필수), `guilds.members.read` (현재 길드 멤버 확인용).

### 4.7 Discord Application 설정 변경

Developer Portal:
- **Activities → Enable Activities** 토글 ON
- **Activities → URL Mappings** (§4.3): Root → `bot.mooklol.com`, `/dd` → `ddragon.leagueoflegends.com`
- **Activities → Supported Platforms**: Desktop / Web (Mobile은 Phase 5 QA 후 추가)
- **OAuth2 → Redirects**: Activity는 SDK authorize 흐름이라 redirect URL 불요. 다만 외부 OAuth 흐름이 필요할 경우 `https://bot.mooklol.com/oauth/callback` 등록.
- **Bot → Privileged Gateway Intents**: 현재와 동일 (Guilds 만)

### 4.8 nginx 구성 (현재 상태)

`~/deploy/nginx/conf.d/default.conf` (2026-04-30 적용):

- Cloudflare IP 대역 22개 → `set_real_ip_from` + `real_ip_header CF-Connecting-IP` (실 클라이언트 IP 복원)
- `default_server`는 `return 444` (직접 IP 접근 차단)
- `server_name bot.mooklol.com`:
  - `/healthz` → 200 `ok`
  - `/api/`, `/ws`, `/` 프록시 블록은 주석으로 미리 배치 — `apps/api`, `apps/activity` 컨테이너 추가 시 주석 해제
- 검증: `curl https://bot.mooklol.com/healthz` → `ok` (Cloudflare → Origin 80 정상 경로)

---

## 5. 데이터 / 상태 모델

### 5.1 D1 스키마 변경

v1 `series` 테이블에 `channel_id` / `message_id` 가 있는데, v2는 채널 메시지 라이프사이클이 사라지므로 **Activity 세션 추적 컬럼**을 더함:

```sql
ALTER TABLE series ADD COLUMN activity_instance_id TEXT;  -- Discord Activity instance
ALTER TABLE series ADD COLUMN activity_started_at INTEGER;
ALTER TABLE series ADD COLUMN end_card_message_id TEXT;   -- 종료 카드 (영속 기록)
ALTER TABLE series ADD COLUMN end_card_channel_id TEXT;
-- channel_id, message_id 는 deprecated — 마이그레이션 후 NULL 허용 + read-only 호환
```

### 5.2 시리즈 상태기계

```
                  Bot                        Activity
─────────────────────────────────  ─────────────────────────────────
RECRUITING ──→ ENTRY_EDITING ──→ READY ──→ IN_GAME(N) ──→ BETWEEN_GAMES ──→ COMPLETED
   ↓               ↓                ↓           ↓               ↓
모집취소       엔트리포기      대기실취소   게임중취소       (없음)         CANCELLED
```

| 상태 | 위치 | 설명 |
|---|---|---|
| `RECRUITING` | Bot 채널 메시지 | 모집 단계, 시리즈 row 미생성. recruitments 테이블만. |
| `ENTRY_EDITING` | Activity 담당자 화면 | 시리즈 row INSERT 시점. 슬롯 배정 진행 중. |
| `READY` | Activity 대기실 | 엔트리 확정. 참가자 read-only 확인. |
| `IN_GAME(N)` | Activity 픽밴/결과 화면 | 게임 N 진행 중 (픽/밴 입력 단계 포함). |
| `BETWEEN_GAMES` | Activity 시리즈 카드 | 게임 N 종료 ~ 게임 N+1 시작 사이. |
| `COMPLETED` | Activity 종료 화면 + Bot 채널 알림 | 시리즈 결정 (Bo3 2-0 또는 2-1). |
| `CANCELLED` | (모든 단계에서 분기) | 운영자 취소 또는 timeout. |

각 전이는 WS broadcast → 룸 참가자 즉시 반영. D1 쓰기는 **상태 변화 시점**에만 (낙관적 UI는 클라이언트 로컬, 서버 ack로 reconcile).

### 5.3 WS 메시지 스키마 (초안)

```ts
// client → server
type ClientMsg =
  | { t: "join", seriesId: number }
  | { t: "ban", game: number, side: "BLUE"|"RED", champ: string }
  | { t: "pick", game: number, side: "BLUE"|"RED", lane: Lane, champ: string }
  | { t: "side", game: number, side: "BLUE"|"RED" }
  | { t: "result", game: number, winner: "BLUE"|"RED", durationMin: number }
  | { t: "assign", lane: Lane, side: "BLUE"|"RED", userId: string }
  | { t: "undo" }
  | { t: "cancel" };

// server → client
type ServerMsg =
  | { t: "snapshot", series: SeriesState }
  | { t: "delta", patch: JsonPatch }
  | { t: "error", code: string, message: string }
  | { t: "ended", summary: string };  // 종료 텍스트 요약 (PNG 없음)
```

낙관적 업데이트 + JSON Patch delta 로 fan-out 비용 최소화.

---

## 6. 봇 ↔ Activity 백엔드 연동

### 6.1 단계 전이 시 채널 텍스트 알림 발행

```
Activity Backend                        Bot
      │                                  │
      │  POST /internal/notify           │
      │  { seriesId, kind, payload }     │
      ├─────────────────────────────────▶│
      │                                  │ embed/V2 TextDisplay 빌드
      │                                  │ channels.send (텍스트 only, PNG 없음)
      │  200 OK { messageId }            │
      ◀─────────────────────────────────┤
```

`kind` 종류:
- `series_started` — [3] → [4] 전이. 메시지: 시리즈 ID + BLUE/RED 라인업 텍스트.
- `game_ended` (선택) — 게임 종료 한 줄 요약.
- `series_ended` — [4] → COMPLETED. 메시지: 3게임 픽밴/MMR 변동 마크다운 표.
- `series_cancelled` — CANCELLED 전이.

내부 호출은 공유 secret (env `INTERNAL_API_KEY`) 로 인증, 같은 VPS 내라면 `127.0.0.1` 바인딩.

### 6.2 진입점 슬래시

| 슬래시 | 동작 |
|---|---|
| `/내전모집` | [1] 모집 메시지 게시. 정원 옵션. |
| `/내전` | 담당자가 [2] 진입. 모집 ID 인자 또는 자동 매칭. Activity launch. |
| `/내전 join <id>` | 진행 중 시리즈에 [3]/[4] 참가자로 합류. |

`/내전` 흐름:
1. 봇이 모집 ID + 담당자 권한 검증
2. 시리즈 row 생성 시점은 Activity 진입 직후 백엔드에서 (`/api/series` POST)
3. 채널에 "Activity 시작" 버튼 메시지 1장 (또는 ephemeral)
4. 사용자가 VC에 있으면 클릭 → Discord 가 Activity 띄움

---

## 7. 마이그레이션 / 롤아웃

### Phase 0 — 분리 ✅
- [x] `mookbot_v2/` 모노레포 스캐폴드 (pnpm workspace)
- [x] `packages/core` 에 v1 `services/{db,riot,mmr,datadragon,cloudflare,logger}` 이식
- [x] D1 신규 DB (`c2e51c8c-...`) 마이그레이션 적용 — v1 스키마 + v2 ALTER 4개

### Phase 1 — Activity skeleton ✅
- [x] 도메인·DNS·TLS·nginx 인프라 (§4) — `bot.mooklol.com` 외부 검증 완료
- [x] Discord Developer Portal Activity 활성화 + URL Mapping (Root → bot.mooklol.com)
- [x] `apps/api` Fastify + ws + cookie 부트 (Docker 배포 완료)
- [x] `apps/activity` Vite + React + Embedded SDK 2.4.1 부트 (Docker 배포 완료)
- [x] OAuth2 5-stage 인증 흐름 (ready → authorize → token-exchange → authenticate → session) 검증
- [x] OAuth2 Redirect URL 등록 (`https://bot.mooklol.com`)
- [x] 이용약관 / 개인정보 보호 정책 페이지 게시

### Phase 2 — 4단계 시리즈 라이프사이클 ✅

**[1] 모집 (Bot)** ✅
- [x] `apps/bot` 부트 — discord.js v14 + `@mookbot/core` consumer + Components V2 메시지
- [x] `/내전모집` 슬래시 — 채널 메시지 + 참석 등록 버튼 + 라인 선호 StringSelect
- [x] `recruitments` 테이블 wire
- [x] 정원 도달 → 운영자에게 [▶ 엔트리 수정 시작] 버튼 노출
- [x] 운영자 [+ 멤버 관리] (UserSelectMenu) — 다른 멤버 강제 추가/제거
- [x] [모집 취소] (status=CANCELLED), 라인 선호 변경 시 자동 참가
- [x] 임베드 → Components V2 (`MessageFlags.IsComponentsV2`) 전환 — 다른 사용자 가시성 보장

**[2] 엔트리 수정 (Activity 담당자)** ✅
- [x] `apps/activity` Vite + React + daisyUI + Embedded SDK
- [x] 드래그&드롭 슬롯 보드 (1팀/2팀 × 5라인) — sticky 제거 + 단일 스크롤
- [x] 후보 풀: 가로 컴팩트 카드 — 라인 선호 + W/L + 자주 쓰는 챔프 5개 (DD 아이콘 + WR%)
- [x] 시리즈 row INSERT (status=`IN_PROGRESS`) + 모집 status=`CONVERTED`

**[3] 대기실 = 대시보드 "진행중인 내전" 카드** ✅
- [x] LineupPreview (3컬럼 미니멀: 라인 / 1팀 / 2팀)
- [x] 클릭 → PickBan 화면 진입

**[4] 픽/밴 + 결과 (Activity)** ✅
- [x] DD 챔프 그리드 + 검색 + 초기화 버튼 (60px 셀, 한글/영문 매치)
- [x] 5밴 / 5픽 슬롯 (라인별, 플레이어명 + 챔프명 인라인)
- [x] **사이드 결정** — 1팀 BLUE/RED 선택, 2팀 자동 반대
- [x] **Hard Fearless** — 시리즈 내 이전 게임 픽 자동 비활성화 + F 배지
- [x] **결과 입력** — 승팀 + duration (분), 게임 row INSERT + game_picks/bans/stats + MMR 업데이트
- [x] **Bo3 자동 종료** — 한 팀 2승 도달 시 status=COMPLETED + 우승팀 표시
- [x] **Game N → N+1 게이팅** — 이전 게임 미완료면 다음 탭 disabled
- [x] **직전 게임 되돌리기 [↺]** — DELETE last game + MMR 복원 (2-click 확인)
- [x] **시리즈 → 모집 되돌리기** — 게임 0개일 때만 (FK 순서 보정 적용)
- [x] pickban draft auto-save (guild_kv) — Activity 재진입 시 복원

**[5] 지난 내전 보기** ✅
- [x] 대시보드에 "지난 내전" 섹션 (COMPLETED 시리즈 카드 + 스코어 + 우승팀)
- [x] SeriesResult 화면 — 게임별 양 팀 박스 (승자 success ring) + 라인업 + 챔프 아이콘

**WebSocket 룸 + 채널 알림** ✅
- [x] `apps/api/src/ws/{rooms,server}.ts` — topic 기반 broadcast (`dashboard`, `recruitment:N`, `series:N`)
- [x] Activity `wsClient.subscribe(topic, cb)` — 자동 재연결 + 다중 구독
- [x] api 의 모든 write 엔드포인트 → 해당 topic invalidate
- [x] `POST /internal/notify` (X-Internal-Key 인증) — 봇이 D1 직접 쓸 때 api 에 broadcast 트리거
- [x] 봇 `notify(topic)` 헬퍼 — 참가자 변경 / 모집 상태 전이 / 멤버 관리 후 호출

### Phase 3 — read-only 슬래시 ✅ (8개 명령)
- [x] `/내전모집` ([1] 모집)
- [x] `/등록` (디스코드 + Riot ID 연결 선택)
- [x] `/일괄등록` (운영자, dry_run 미리보기, 별명 라이엇 ID 자동 매칭)
- [x] `/내정보` (등록 정보 + 시즌 라인별 MMR)
- [x] `/내전기록` (라인별 통계 + 최근 MMR 변동)
- [x] `/랭킹` (라인별 시즌 MMR Top 10)
- [x] `/전적` (Riot 솔로/자유 랭크 + 마스터리 Top 5)
- [x] `/지금게임` (Riot Spectator API — 라이브 매치업 + 밴)

### 인프라·보안 추가 완료 ✅
- [x] **권한 분기** (`OPERATOR_ROLE_ID` 또는 `OPERATOR_ROLE_NAME`) — 운영자 role 만 쓰기 허용. read-only 사용자는 UI 비활성화 + 서버 403
- [x] **이용약관 / 개인정보 보호 정책** 페이지 (`/terms`, `/privacy`) — Discord OAuth2 동의 필수
- [x] **버전 관리** — root `package.json` SoT, `pnpm version:*` + `pnpm docker:release` 로 X.Y.Z + latest 두 태그 동시 push
- [x] **Git private repo** (Longcat2957/mookbot_v2)
- [x] **Discord 슬래시 Guild Install only** — User Install context 응답 ephemeral 이슈 회피
- [x] **API 클라이언트 빈 body 처리** — Fastify "empty json body" 400 회피

---

### Phase 4 — 운영 안정화 (다음 작업)

| 우선순위 | 항목 | 비고 |
|---|---|---|
| 🟥 높음 | Cloudflare SSL Full(strict) 전환 | 현재 Flexible. Cloudflare → Origin 평문 구간 제거. Origin Cert 발급 + nginx 443 listen |
| 🟥 높음 | D1 자동 백업 GHA | v1 의 매일 03:00 KST artifact 백업 이식 |
| 🟧 중간 | 운영자 admin 슬래시 | `/시리즈강제삭제`, `/MMR수정`, `/시즌결과리셋`, `/오래된내전정리` (v1 코드 단순 이식) |
| 🟧 중간 | 헬스체크 + 모니터링 | api/bot 컨테이너 `HEALTHCHECK`, 외부 모니터링 (UptimeRobot 등) |
| 🟧 중간 | Sentry 에러 트래킹 | api/bot/activity 3곳 — Phase 2 마무리 후 운영 데이터 수집 |
| 🟨 낮음 | 모바일 Activity QA | iOS/Android Discord 클라이언트 검증 — 안정 시 Developer Portal Mobile platform 활성화 |
| 🟨 낮음 | 봇 → 채널 시리즈 종료 알림 | 결과 카드 (3게임 픽밴/MMR 변동 마크다운 표). v0.7 종료 카드를 텍스트로 |
| 🟨 낮음 | E2E 테스트 | v1 의 `test:scrim` / `test:nvn` 이식. CI에서 D1 throwaway 환경 |

### Phase 5 — 후속 개선 (백로그)

- 자동 분배 알고리즘 (MMR + 라인 선호 기반) — 현재 수동 드래그&드롭만
- SeriesResult 에 BAN 표시 (현재 PICK 만)
- 시리즈 진행 중 다른 사용자가 픽밴 보고 있으면 cursor presence (활성 입력자 표시)
- 시즌 전환 / 종료 (현재 단일 시즌 자동 생성)
- 매치 자동 감지 (Riot Match-V5 폴링) — 운영자 입력 절감

---

**현재 상태**: v0.1.1 — Phase 0~3 완료, 실서비스 가능. 핵심 효용(엔트리 작성 + 픽밴 latency 해결) 검증 끝. Phase 4 운영 안정화로 진입.

---

## 8. 리스크 및 결정 필요 사항

### 8.1 결정 사항 (모두 결정 완료)

- [x] ~~**호스팅**~~ — 현재 VPS 단일 + nginx Docker (2026-04-30)
- [x] ~~**도메인**~~ — `bot.mooklol.com` 단일 호스트 path-based routing (2026-04-30)
- [x] ~~**read-only 슬래시 처리**~~ — 봇 유지 + 텍스트 출력 (Components V2). Activity 흡수는 안 함 (잡담 중 즉시 조회 가치 큼)
- [x] ~~**채널 영속 기록 범위**~~ — 모집 메시지는 V2 컴포넌트로 항상 갱신, 시리즈 종료 알림은 Phase 4 백로그 (텍스트 요약 webhook)
- [ ] **모바일 지원 우선순위** — Phase 4 QA 후 결정. 안정성 검증되면 Developer Portal Mobile platform 활성화

### 8.2 리스크

| 리스크 | 영향 | 완화 |
|---|---|---|
| 모바일 Activity 불안정 | 모바일 사용자 차단 | Phase 5 QA, 필요 시 봇 슬래시 fallback |
| Discord Activity API 정책 변경 | 운영 중단 | 봇 진입점 + read-only 카드는 유지하므로 최소 기능은 살아남음 |
| HTTPS/도메인 운영 부담 | 신규 운영 항목 | Caddy 자동 TLS, Cloudflare 프록시로 간소화 |
| WS 동시 접속 부하 | api 다운 | 시리즈당 룸 격리, 룸 ≤ 10 인 |
| OAuth2 scope 동의 마찰 | 진입 이탈 | `identify` 만으로 시작, `guilds.members.read` 는 필요 시 추가 |
| v1 데이터 마이그레이션 누락 | 기록 손실 | D1 스키마는 ALTER 만, 기존 컬럼 유지하며 deprecated 처리 |

### 8.3 비용 추정 (월)

| 항목 | 비용 |
|---|---|
| VPS (현재 그대로) | $0 추가 |
| 도메인 | ~$1 (.com 연 $12) |
| Cloudflare (선택) | $0 (free tier) |
| Sentry (선택) | $0 (free tier) |
| **합계** | **~$1/월 추가** |

---

## 9. 성공 지표

Phase 2 완료 시 다음을 측정·기록한다.

| 지표 | v1 | v2 목표 | 측정법 |
|---|---|---|---|
| 버튼 → UI 갱신 latency | 700~1500ms | <50ms | 클라이언트 perf timing |
| 픽/밴 5v5 입력 시간 | ~3.2s (모달 4-step) | <10s 전체 (드래그) | 사용자 시간 측정 |
| 시리즈 1회 Discord API 호출 수 | ~30~60 | ~5 (진입 + 종료 카드) | 로그 카운트 |
| satori PNG 렌더 횟수 / 시리즈 | ~10~20 | 1 | 로그 카운트 |
| 모바일 사용자 입력 실패율 | ? | <5% | Phase 5 QA |

---

## 10. 다음 작업 (이 문서 다음 단계)

이 문서가 합의되면:
1. `mookbot_v2/` 디렉토리에 §3.1 모노레포 스캐폴드.
2. `packages/core` 추출 PoC — v1 봇이 그대로 동작하는지 검증.
3. Discord Developer Portal Activity 활성화 + URL Mapping 임시 설정 (개발용 `localhost` ngrok).
4. `apps/activity` hello-world.

이전에 §8.1 결정 사항 합의가 선행되어야 한다.
