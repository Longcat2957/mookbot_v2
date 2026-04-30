# 사용자 셋업 체크리스트

> 코드로 자동화 불가능한, 사람이 콘솔에서 처리해야 하는 항목 모음.
> 진행 순서대로 정리.

---

## 1. Discord Developer Portal — Activity 활성화

**위치**: https://discord.com/developers/applications → 해당 앱 (CLIENT_ID 와 일치) → **Activities**

### 1.1 Enable Activities
- 좌측 사이드바 **Activities** → **Getting Started** 페이지에서 활성화
- "Enable Activities" 토글 ON

### 1.2 URL Mappings
**Activities → URL Mappings** 에서 다음 1개 매핑 추가:

| Prefix | Target |
|---|---|
| `/` (Root) | `bot.mooklol.com` |

> 추가로 외부 자산 (Data Dragon 챔피언 아이콘) 이 필요해지면 `/dd → ddragon.leagueoflegends.com` 도 추가. 현 단계에선 불필요.

### 1.3 Supported Platforms
**Activities → Settings**:
- Desktop: ON
- Web: ON
- Mobile (iOS/Android): **OFF** (Phase 5 QA 후 활성화 — PLAN.md §8.2)

### 1.4 OAuth2 Client Secret 가져오기
**OAuth2 → Client Information** 페이지:
- "Client Secret" 의 **Reset Secret** 클릭 → 발급된 값 복사 (한 번만 보임)
- → `.env` 의 `DISCORD_CLIENT_SECRET=` 에 붙여넣기

> Reset 시 기존 OAuth 토큰이 모두 무효화됨. v1 봇이 OAuth 를 안 쓰면 영향 없음.

### 1.5 OAuth2 Redirects (선택)
**OAuth2 → Redirects**: Activity SDK 흐름에서는 redirect URL 불요 (SDK 가 client-side 에서 처리). 외부 OAuth 가 필요해지면 `https://bot.mooklol.com/oauth/callback` 추가.

### 1.6 Bot Intents
**Bot → Privileged Gateway Intents**: 현재 v1 과 동일 (`Guilds` 만). 변경 없음.

---

## 2. .env 보강

작업 디렉토리: `/home/min/p_projects/mookbot_v2/.env`

자동 채워진 항목:
- `VITE_DISCORD_CLIENT_ID` — `CLIENT_ID` 값을 복제해서 채움 ✓
- `SESSION_SECRET` — `openssl rand -hex 32` 로 생성됨 ✓
- `API_PORT=3000`, `API_HOST=127.0.0.1` ✓

**사용자가 채워야 할 값** (1개):
```
DISCORD_CLIENT_SECRET=<§1.4 에서 복사한 값>
```

---

## 3. Cloudflare 추가 설정 (이미 적용된 것 + 향후 필요)

### 이미 OK
- DNS: `bot A → 141.164.46.191`, Proxied ✓
- Universal SSL (Flexible 모드) — `https://bot.mooklol.com/healthz` 외부 검증됨 ✓

### Phase 1 진입 시 권장 (선택)
- **SSL/TLS → Overview** 모드를 **Full (strict)** 로 전환
  - VPS 에서 nginx 443 listen + Cloudflare Origin Certificate 발급/배포 필요
  - 지금은 Flexible 로 충분 (Cloudflare ↔ Origin 구간이 같은 데이터센터 망인 경우 위험 낮음)

### Activity 가 실제 띄워지기 시작하면 확인
- **Network → WebSockets** = Enabled (기본 ON, 확인만)
- **Speed → Optimization** 의 일부 기능 (Auto Minify, Rocket Loader) 은 Activity SPA 에 영향 줄 수 있음 → 문제 시 OFF

---

## 4. Discord Developer Portal — 진행 후 확인

§1 완료 후 다음 명령으로 dev 환경에서 Activity 진입 가능해짐 (Phase 1 부트가 아직 미완성이므로 이건 다음 단계):

```bash
# 빌드된 SPA 를 nginx 에 마운트하거나, 별도 dev 서버를 띄운 뒤
# Discord 클라이언트에서 보이스 채널 → Activity 시작 → 해당 앱 선택
```

---

## 5. 현 단계 사용자 작업 요약 (To-Do)

- [ ] §1.1 Enable Activities
- [ ] §1.2 URL Mappings: Root → `bot.mooklol.com`
- [ ] §1.3 Supported Platforms (Desktop/Web ON, Mobile OFF)
- [ ] §1.4 Client Secret 발급 → §2 의 `.env` 에 채우기
- [ ] (선택) §3 Cloudflare Full(strict) — 나중에 해도 됨

§1.4 의 Client Secret 만 채우면 다음 코드 단계 (apps/api 토큰 교환 검증) 진행 가능.
