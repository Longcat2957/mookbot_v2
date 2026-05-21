# MonkeyScrimBot

Discord 기반 League of Legends 내전 운영 봇과 Activity 웹앱입니다. 모집, 참가자 등록, 픽밴, 결과 기록, 랭킹, 전적 조회, 운영자용 전적검토까지 한 흐름으로 처리합니다.

코드베이스 이름과 Docker 이미지는 기존 호환성 때문에 `mookbot`을 유지하지만, 사용자 노출 브랜드는 **MonkeyScrimBot**입니다.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)

## 주요 기능

- Discord slash command 기반 내전 운영
- Discord Activity 기반 참가자 편집, 픽밴, 결과 입력 UI
- Riot API 연동 계정 등록, 전적 조회, 현재 게임 조회
- D1 기반 내전 기록, MMR, 랭킹, 프로필 관리
- 운영자용 `/전적검토`
  - 최근 솔로랭크 표본 분석
  - 티어/포지션 benchmark 대비 과성과, 저성과 감지
  - 패배패턴, 계정 일관성 신호 분리 표시
  - 확정 판정이 아닌 운영 검토용 신호 제공

## Monorepo 구성

| 경로 | 역할 |
| --- | --- |
| `apps/bot` | Discord bot. slash command, 모집 메시지, 운영자 명령 처리 |
| `apps/api` | Fastify API + WebSocket. Activity backend, OAuth2 session, D1 접근 |
| `apps/activity` | Vite + React + daisyUI. Discord Activity UI |
| `packages/core` | 공유 도메인 코드. D1, Riot API, MMR, 전적검토, Data Dragon |
| `scripts` | Docker build/push, VPS deploy 등 운영 스크립트 |

## 서비스 도메인

- Production: `https://bot.mooklol.com`
- VPS nginx가 Activity 정적 파일, `/api`, `/ws`, `/dd` Data Dragon proxy를 라우팅합니다.
- Discord bot은 outbound only로 Discord Gateway에 연결됩니다.

## 개발 환경

필수:

- Node.js 22 이상
- pnpm 10.x
- Discord application/bot 설정
- Riot API key
- Cloudflare D1 database

설정 파일:

- `.env.example`을 기준으로 `.env`를 만듭니다.
- `.env`, `.env.local`, `.codex`, `.claude` 같은 로컬 파일은 커밋하지 않습니다.

주요 환경변수:

| 그룹 | 변수 |
| --- | --- |
| Discord | `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, `DISCORD_CLIENT_SECRET`, `VITE_DISCORD_CLIENT_ID` |
| Cloudflare D1 | `CF_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_API_TOKEN` |
| Riot | `RIOT_API_KEY` |
| Session | `SESSION_SECRET` |
| Operator | `OPERATOR_ROLE_ID` 또는 `OPERATOR_ROLE_NAME` |
| Internal RPC | `INTERNAL_API_KEY` |

## 로컬 실행

```bash
pnpm install
pnpm --filter @mookbot/core build
pnpm --filter @mookbot/api dev
pnpm --filter @mookbot/activity dev
pnpm --filter @mookbot/bot dev
```

슬래시 명령 수동 등록:

```bash
pnpm --filter @mookbot/bot exec tsx src/deploy-commands.ts
```

D1 schema migrate:

```bash
pnpm --filter @mookbot/core db:migrate
```

## 검증

```bash
pnpm check
pnpm typecheck
pnpm test
pnpm build
```

좁은 범위부터 확인할 때:

```bash
pnpm --filter @mookbot/core test
pnpm --filter @mookbot/activity typecheck
pnpm --filter @mookbot/activity build
```

## 전적검토 benchmark 갱신

`/전적검토`는 `packages/core/src/screening/benchmarks.json`을 기준선 데이터로 사용합니다. 이 파일은 수동 파싱 결과인 루트 `merged.json`을 검토한 뒤 반영합니다.

현재 사용 흐름:

1. 외부/수동 파싱 작업으로 루트에 `merged.json`을 생성합니다.
2. JSON 구조와 값이 유효한지 확인합니다.
3. 문제가 없으면 `merged.json` 내용을 `packages/core/src/screening/benchmarks.json`에 반영합니다.
4. `pnpm --filter @mookbot/core test`, `pnpm typecheck`, `pnpm build`를 실행합니다.
5. 전적검토 결과가 의도대로 바뀌었는지 실제 계정 몇 개로 `/전적검토 refresh:true`를 확인합니다.
6. `packages/core/src/screening/benchmarks.json`만 커밋합니다. 루트 `merged.json`은 작업 산출물로 보고 보통 커밋하지 않습니다.

간단한 반영 명령:

```bash
cp merged.json packages/core/src/screening/benchmarks.json
pnpm --filter @mookbot/core test
pnpm typecheck
pnpm build
```

주의사항:

- `benchmarks.json`은 runtime에서 직접 로드되고, core build 때 `dist/screening/benchmarks.json`으로 복사됩니다.
- benchmark 구조는 `csm`, `kda`, `kills`, `deaths`별로 `top`, `jungle`, `middle`, `bottom`, `support` 역할 데이터를 가져야 합니다.
- tier key는 Riot tier 문자열과 맞춰 `IRON`, `BRONZE`, `SILVER`, `GOLD`, `PLATINUM`, `EMERALD`, `DIAMOND`, `MASTER`, `GRANDMASTER`, `CHALLENGER` 형식을 사용합니다.
- `value`가 기본 기준선이며, `redside`/`blueside`가 있으면 단일 side 표본에서 side 기준선을 우선 사용합니다.
- benchmark를 갱신하면 캐시 영향이 있을 수 있습니다. 전적검토 로직 변경 또는 기준선 대규모 변경 시 bot/api의 screening cache version도 올려 기존 캐시를 무효화합니다.

## 배포

표준 배포:

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm deploy:vps
```

`pnpm deploy:vps`가 수행하는 작업:

1. working tree와 remote sync preflight 확인
2. D1 schema migrate
3. `api`, `bot`, `activity` Docker image build
4. Docker Hub `longcat1132/mookbot-{api,bot,activity}`에 version tag와 `latest` push
5. VPS에서 image pull 및 docker compose 재기동
6. health check
7. Discord slash command 등록

루트 `package.json`의 `version`이 Docker image version tag의 기준입니다.

버전 갱신:

```bash
pnpm version:patch
pnpm version:minor
pnpm version:major
```

수동 Docker 작업:

```bash
pnpm docker:build
pnpm docker:push
pnpm docker:release
```

## 운영 메모

- `/전적검토` 결과는 확정 판정이 아니라 운영 검토용 신호입니다.
- `refresh:true`를 쓰면 24시간 캐시를 무시하고 Riot API에서 새로 조회합니다.
- 전적검토 출력에 내부 metric key가 보이면 `apps/bot/src/commands/screeningReport.ts`의 `metricLabel`에 한국어 라벨을 추가합니다.
- Riot API 장애나 rate limit 상황에서는 캐시 또는 stale 결과가 표시될 수 있습니다.
- 배포 전 untracked 작업 파일이 있어도 배포 스크립트는 경고 후 진행할 수 있지만, 커밋 대상은 항상 확인합니다.

## 관련 문서

- [`ROADMAP.md`](./ROADMAP.md) — 기능 진행 상황과 백로그
- [`SETUP.md`](./SETUP.md) — Discord Developer Portal 설정
- [`SECURITY.md`](./SECURITY.md) — 보안 정책
- [`NOTICE`](./NOTICE) — 외부 서비스 attribution

## 라이선스

[Apache License 2.0](./LICENSE)

이 프로젝트는 Discord Inc. 또는 Riot Games, Inc.와 무관하며, 양사의 공식 제품 또는 서비스가 아닙니다.
