# mookbot v2 시스템 소개

mookbot v2는 Discord 기반 League of Legends 내전 운영을 자동화하고 시각화하는 통합 시스템입니다. Discord 봇, Embedded Activity, API 서버, 공유 도메인 패키지, Riot API, Cloudflare D1, Redis/Valkey 기반 실시간 상태 저장소를 결합해 내전 모집부터 결과 기록까지 한 흐름으로 처리합니다.

사용자에게 보이는 서비스 브랜드는 **monkey**입니다. `mookbot`은 npm 패키지, Docker 이미지, 모노레포 식별자에 남아 있는 내부 이름입니다.

## 왜 만들었나

기존 Discord 채널 메시지 중심 운영은 다음 문제가 있었습니다.

- 모집 메시지 수정과 버튼 처리 지연
- 팀 편성, 픽/밴, 결과 기록이 여러 채널과 수작업에 흩어짐
- 운영자 권한, 되돌리기, 감사 기록 추적이 불명확함
- 사용자 프로필, MMR, 리더보드 같은 누적 데이터 접근성이 낮음

mookbot v2는 핵심 인터랙션을 Discord Activity로 옮겨, 운영자가 하나의 화면에서 참가자 편성, 픽/밴, 게임 기록, 경매 내전 진행을 처리하도록 설계되었습니다.

## 핵심 사용자 경험

### 일반 내전

1. 운영자가 Discord 슬래시 명령으로 내전 모집을 생성합니다.
2. 참가자가 Discord 메시지 버튼으로 참여하거나 나갑니다.
3. 정원이 차면 운영자가 Activity에 진입합니다.
4. Activity에서 참가자를 팀과 라인에 배치합니다.
5. 픽/밴 화면에서 챔피언을 입력하고 게임 결과를 기록합니다.
6. Bo3가 끝나면 시리즈가 완료되고 MMR, 전적, 종료 카드, audit log가 반영됩니다.

### 경매 내전

1. 운영자가 경매 내전 모집을 생성합니다.
2. 참가자가 모이면 Activity에서 팀장을 선출합니다.
3. 팀별 포인트를 배정합니다.
4. 매물 후보를 뽑고 입찰/낙찰/유찰을 진행합니다.
5. 완성된 팀으로 토너먼트를 진행합니다.
6. 결과가 기록되고 챔피언 통계와 경매 결과 화면이 갱신됩니다.

## 주요 기능

### 모집 및 엔트리 편성

- 일반 내전 모집
- 경매 내전 모집
- 모집 메시지 자동 갱신
- 참가자 추가/삭제
- 드래그 앤 드롭 기반 엔트리 편성
- 팀 좌우 swap
- 역할/라인 기반 편성 보조
- 자동 저장과 WebSocket 동기화

### 픽/밴 및 게임 기록

- Data Dragon 기반 챔피언 카탈로그
- 밴/픽 슬롯 입력
- Hard Fearless 규칙 지원
- Bo1/Bo3 흐름
- 게임별 승리팀 기록
- 직전 게임 되돌리기
- 시리즈 완료 처리
- 종료 카드 자동 발행

### 사용자 프로필 및 리더보드

- 라인별 MMR
- 통합 리더보드
- 사용자 프로필
- Riot 계정 연결 및 메인 계정 관리
- League 소환사 아이콘 기반 아바타
- 최근 내전 기록
- 선호 챔피언 및 챔피언 통계

### 경매 내전

- 팀장 선출
- 포인트 배정
- 현재 매물 후보 공유
- 입찰 의도 실시간 공유
- 낙찰, 수동 배치, 유찰 처리
- 단계 되돌리기
- 10인/20인 토너먼트 진행
- 경매 결과 화면

### 운영 및 안전성

- `BalanceTeam` 역할 기반 운영자 권한
- destructive action audit log
- 정상 lifecycle audit log
- 시리즈, 경매 토너먼트, 사용자 soft-delete
- soft-delete 사용자 리더보드 비노출
- D1 migration safety guard
- 배포 전 D1 migration 자동 실행
- Discord 내부 RPC shared secret 검증
- 운영자 권한 진단 화면

## 시스템 아키텍처

```text
Discord
  ├─ Bot slash commands / message components
  └─ Embedded Activity iframe

VPS / Docker compose
  ├─ nginx
  ├─ activity (Vite React static app)
  ├─ api (Fastify + WebSocket)
  ├─ bot (discord.js)
  └─ valkey (hot KV + pub/sub)

External services
  ├─ Cloudflare D1
  ├─ Cloudflare proxy / TLS
  ├─ Riot API
  └─ Data Dragon
```

## 구성 요소

| 컴포넌트 | 위치 | 역할 |
|---|---|---|
| Discord Bot | `apps/bot` | 슬래시 명령, 모집 메시지, Discord 버튼 처리, 내부 알림 |
| API Server | `apps/api` | Activity API, OAuth 세션, DB write/read, WebSocket broadcast |
| Activity App | `apps/activity` | React UI. 엔트리 편성, 픽/밴, 경매, 프로필, 리더보드 |
| Core Package | `packages/core` | D1 repository, MMR/ELO, Riot client, Data Dragon, KV facade |
| Valkey/Redis | VPS service | hot KV, WebSocket pub/sub, 경매 입찰 의도 저장 |
| Cloudflare D1 | external DB | 영구 데이터 저장소 |

## 데이터 모델 개요

주요 데이터는 Cloudflare D1에 저장됩니다.

- `users`: Discord 사용자와 표시명, soft-delete 상태
- `riot_accounts`: Riot 계정, 메인 계정, 소환사 아이콘
- `seasons`: 시즌 단위 MMR 구분
- `recruitments`: 일반 내전 모집
- `series`: 일반 내전 시리즈
- `series_participants`: 시리즈 참가자와 팀/라인
- `games`: 일반/경매 게임 공통 기록
- `game_stats`: 챔피언, 라인, 승패 통계
- `user_lane_mmr`: 시즌/라인별 MMR
- `mmr_changes`: 게임별 MMR 변경 로그
- `auction_recruitments`: 경매 내전 모집
- `auction_tournaments`: 경매 토너먼트
- `auction_teams`, `auction_team_members`, `auction_bids`, `auction_matches`: 경매 진행 데이터
- `admin_audit_log`: 운영 감사 로그

## 실시간 동기화

Activity 화면은 WebSocket topic을 구독합니다. API에서 게임 기록, 모집 변경, 경매 상태 변경 같은 이벤트가 발생하면 해당 topic이 invalidate되고, 클라이언트가 필요한 데이터를 다시 가져옵니다.

Redis/Valkey가 설정된 운영 환경에서는 WebSocket broadcast가 pub/sub을 통해 전파됩니다. 개발이나 테스트 환경에서 Redis가 없으면 in-process fallback으로 동작합니다.

## MMR 정책

일반 내전은 MMR에 반영됩니다.

- 라인별 MMR을 따로 관리합니다.
- 게임 결과 기록 시 상대 라인 기준으로 ELO 업데이트를 수행합니다.
- 리더보드는 `games_played > 0`인 사용자만 노출합니다.
- soft-delete된 사용자는 live user join 단계에서 리더보드에서 제외됩니다.

경매 내전은 이벤트성 모드입니다.

- 경매 게임은 MMR을 변경하지 않습니다.
- 다만 챔피언 사용 기록과 승패 통계는 공통 기록에 반영됩니다.

## Riot 연동

Riot API와 Data Dragon을 사용합니다.

- Riot ID 검증
- PUUID 기반 계정 식별
- 소환사 아이콘 백필 및 갱신
- 랭크 정보 조회
- 챔피언 mastery 조회
- 챔피언 아이콘과 이름 표시

Riot API 호출 실패 시에도 핵심 내전 운영은 중단되지 않도록 fail-soft 방식으로 설계되어 있습니다.

## 운영 환경

현재 운영 도메인은 `bot.mooklol.com`입니다.

운영 구조:

- Cloudflare proxied domain
- VPS nginx reverse proxy
- Docker compose 5개 컨테이너
  - `bot`
  - `api`
  - `activity`
  - `nginx`
  - `valkey`
- Docker Hub 이미지
  - `longcat1132/mookbot-api`
  - `longcat1132/mookbot-bot`
  - `longcat1132/mookbot-activity`

## 배포 흐름

루트 `package.json`의 `version`이 단일 버전 기준입니다. Docker 이미지는 이 버전 태그와 `latest` 태그를 함께 사용합니다.

표준 배포는 다음 흐름입니다.

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm version:patch
pnpm deploy:vps
```

`pnpm deploy:vps`는 다음 작업을 수행합니다.

1. working tree와 remote sync 확인
2. D1 schema migration
3. Docker image build
4. Docker image push
5. VPS compose pull/up
6. healthcheck
7. Discord slash command 등록

## 품질 관리

주요 검증 명령:

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm check
```

테스트 범위:

- core DB repository
- MMR 계산
- Riot ID parsing
- API route integration
- auth/permission cache
- PickBan state hook
- EntryEditing state hook
- Redis/Valkey KV routing

## 설계 원칙

### Discord 안에서 끝내기

사용자는 별도 웹사이트로 이동하지 않고 Discord Activity 안에서 모집, 편성, 픽/밴, 결과 확인을 수행합니다.

### 운영자 수동 밸런싱 존중

자동 팀 추천이나 자동 매칭은 핵심 목표가 아닙니다. 운영자가 직접 판단하는 밸런싱 흐름을 빠르고 안전하게 만드는 것이 목표입니다.

### 기록은 보존, 노출은 제어

시리즈, 토너먼트, 사용자 삭제는 대부분 soft-delete입니다. 운영 기록과 통계 복구 가능성을 유지하면서 사용자 화면에서는 숨깁니다.

### 실패해도 핵심 흐름 유지

Riot API, Data Dragon, Discord 메시지 발행 같은 외부 의존성은 fail-soft로 처리합니다. 내전 기록 자체가 가장 중요한 원장입니다.

## 현재 버전 상태

- 버전: `v0.18.9`
- 운영 중: 예
- 주요 최근 변경:
  - 유저 soft-delete
  - soft-delete 사용자 리더보드 비노출
  - MiniGame UI 재설계
  - Valkey/Redis KV backend
  - WebSocket Pub/Sub
  - D1 migration safety

## 한 줄 요약

mookbot v2는 Discord 서버 안에서 LoL 내전 운영자가 하던 모집, 팀 편성, 픽/밴, 결과 기록, MMR 반영, 리더보드 관리를 하나의 Activity 기반 운영 도구로 통합한 시스템입니다.
