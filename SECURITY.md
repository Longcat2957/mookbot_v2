# 보안 정책 (Security Policy)

## 지원 버전 (Supported versions)

릴리스는 단일 라인으로 진행하며 항상 `main` 의 최신 태그만 보안 패치 대상입니다.

| 버전 | 지원 |
|---|---|
| 최신 `0.x` (현재 main) | ✅ |
| 그 이전 | ❌ (업그레이드 권장) |

## 취약점 보고 (Reporting a vulnerability)

**공개 이슈로 올리지 마세요.** 다음 채널 중 하나로 비공개 보고 부탁드립니다.

1. **GitHub Private Vulnerability Reporting** (권장)
   `Security` 탭 → `Report a vulnerability`
2. **이메일** — 메인테이너 GitHub 프로필 공개 연락처

다음 정보를 포함해주시면 응답이 빨라집니다.
- 영향 받는 컴포넌트 (`apps/api`, `apps/bot`, `apps/activity`, `packages/core`, 인프라)
- 재현 절차 / PoC
- 예상 영향 범위 (정보 노출 / 권한 우회 / DoS 등)
- 보고자 credit 표기 희망 여부

## 응답 SLA (Best-effort)

| 단계 | 목표 |
|---|---|
| 1차 회신 | 영업일 기준 5일 이내 |
| 영향 평가 + 임시 완화 가이드 | 14일 이내 |
| 패치 릴리스 | 심각도에 따라 30~90일 |

상시 모니터링되는 팀이 아니라 best-effort 입니다. 광범위한 영향이 예상되는 사안은 우선 처리합니다.

## 범위 (Scope)

**대상 안:**
- 본 저장소의 소스코드 (`apps/`, `packages/`, `scripts/`, `docs/`)
- 빌드/배포 파이프라인 (`Dockerfile`, GitHub Actions 워크플로)
- API 인증/세션/권한 흐름 (`apps/api/src/auth`, `apps/api/src/http/auth.ts`)

**대상 밖:**
- Discord, Riot Games, Cloudflare 등 외부 플랫폼 자체의 취약점 → 각 플랫폼의 보안 보고 채널로
- 운영자가 본인 인스턴스에 잘못 설정한 결과로 발생한 노출 (예: `.env` 커밋, role 권한 오설정)
- 의존성 패키지의 알려진 CVE — 가급적 Dependabot 알림으로 자동 처리

## 안전한 운영 가이드 (자가 호스팅 시)

이 프로젝트를 직접 호스팅한다면 다음을 확인하세요.

- `.env`, `.env.local`, `.env.bak*` 가 git 에 커밋되지 않도록 `.gitignore` 유지
- `DISCORD_TOKEN`, `DISCORD_CLIENT_SECRET`, `RIOT_API_KEY`, `CLOUDFLARE_API_TOKEN`, `SESSION_SECRET`, `INTERNAL_API_KEY` 노출 시 즉시 회전
- `OPERATOR_ROLE_ID` 미설정 = 모든 인증 사용자에게 쓰기 권한 부여 (개발용 fallback) — 운영 환경에서는 반드시 설정
- `INTERNAL_API_BASE` 는 같은 docker network 내부에서만 도달 가능하도록 binding
- nginx 가 `/api/*` 외부 노출 시 Cloudflare Proxy + (가능하면) WAF rule 적용 권장
