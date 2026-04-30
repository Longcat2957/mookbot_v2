# mookbot v2

Discord 기반 LoL 내전(Bo3) 운영 봇 + Activity (Embedded App SDK).

채널 메시지 edit 기반 UI(v1) 의 latency / refresh 병목을 해소하기 위해 Discord Activity 로 코어 인터랙션을 이전한 풀 리팩토링.

## 구성

| 패키지 | 역할 |
|---|---|
| `apps/bot` | discord.js — 슬래시 명령(`/내전모집`, `/등록`, `/내정보`, `/내전기록`, `/랭킹`, `/전적`, `/지금게임`, `/일괄등록`) + 모집 메시지 (Components V2) |
| `apps/api` | Fastify + WebSocket — Activity 백엔드, OAuth2 세션, D1 read/write, 토픽 기반 broadcast |
| `apps/activity` | Vite + React + daisyUI + `@discord/embedded-app-sdk` — 엔트리 수정(드래그&드롭) / 픽밴 / 결과 / 지난 내전 보기 |
| `packages/core` | 공유: D1 클라이언트 / 도메인 레포지토리 / Riot API / MMR(ELO) / Data Dragon |

## 배포 도메인

- `https://bot.mooklol.com` (Cloudflare proxied → VPS nginx)
- nginx 가 `/`, `/api/`, `/ws`, `/dd/` (Data Dragon 프록시) 라우팅
- bot 은 outbound only (Discord Gateway)

## 환경변수

`.env.example` 참고. 핵심 셋:
- Discord: `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, `DISCORD_CLIENT_SECRET`, `VITE_DISCORD_CLIENT_ID`
- Cloudflare D1: `CF_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_API_TOKEN`
- Riot: `RIOT_API_KEY`
- 세션: `SESSION_SECRET`
- 권한 (선택): `OPERATOR_ROLE_ID` 또는 `OPERATOR_ROLE_NAME`
- 봇 ↔ api 내부 RPC: `INTERNAL_API_KEY`

## 개발

```bash
pnpm install
pnpm --filter @mookbot/core build      # core 먼저 빌드
pnpm --filter @mookbot/api dev         # api dev (port 3000)
pnpm --filter @mookbot/activity dev    # activity dev (Vite, port 5173)
pnpm --filter @mookbot/bot dev         # bot dev
pnpm --filter @mookbot/bot exec tsx src/deploy-commands.ts  # 슬래시 등록
pnpm --filter @mookbot/core db:migrate                       # D1 스키마 마이그레이션
```

## 배포 (현재)

각 앱은 Docker 이미지로 빌드 → Docker Hub (`longcat1132/mookbot-{api,bot,activity}`) → VPS docker compose. 자세한 흐름은 `PLAN.md` §4 참조.

## 문서

- `PLAN.md` — 시리즈 라이프사이클, 아키텍처, HTTPS / nginx / OAuth2, 마이그레이션 단계
- `SETUP.md` — Discord Developer Portal 셋업 체크리스트 (Activity / OAuth2 / Bot Intents)
