#!/usr/bin/env bash
# 로컬에서 commit/push 끝난 상태로 VPS 까지 한 번에 배포.
# 사용: pnpm deploy:vps  또는  scripts/deploy-vps.sh [--skip-commands]
#
# 시퀀스:
#   1. preflight  — working tree clean + main 과 origin/main sync 확인
#   2. D1 schema migrate  — schema.sql 의 ALTER ADD COLUMN / CREATE INDEX 멱등 적용
#   3. docker:release  — 3개 이미지 build + push (X.Y.Z + latest)
#   4. VPS pull + up -d  — ssh root@141.164.46.191 로 적용
#   5. health verify  — 컨테이너 상태 출력
#   6. slash command 등록  — Discord 에 명령어 PUT (새 컨테이너 healthy 이후)
#
# 옵션:
#   --skip-commands  — step 6 (Discord 명령 등록) 건너뜀. 명령 변경 0 일 때만 사용.
#
# 가정:
#   - 변경분 commit + git push origin main 이 이미 완료됨
#   - VPS 호스트: root@141.164.46.191, 배포 dir: /root/deploy
#   - 로컬에 DISCORD_TOKEN / CLIENT_ID 가 .env 에 있음 (deploy-commands 가 사용)

set -euo pipefail

# --- arg parse -------------------------------------------------------------
SKIP_COMMANDS=0
for arg in "$@"; do
	case "$arg" in
		--skip-commands)
			SKIP_COMMANDS=1
			;;
		*)
			echo "[deploy-vps] ERROR: unknown arg '$arg' (지원: --skip-commands)" >&2
			exit 1
			;;
	esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

VPS_HOST="root@141.164.46.191"
VPS_DIR="/root/deploy"
MAIN_BRANCH="main"

VERSION="$(node -p "require('./package.json').version")"
echo "[deploy-vps] version: $VERSION"

# --- 1. preflight ----------------------------------------------------------
echo "[deploy-vps] preflight: working tree + remote sync 확인"
if ! git diff-index --quiet HEAD --; then
	echo "[deploy-vps] ERROR: 미커밋 변경사항이 있습니다. commit 후 재시도하세요." >&2
	git status --short >&2
	exit 1
fi
if [ -n "$(git ls-files --others --exclude-standard)" ]; then
	echo "[deploy-vps] WARN: untracked 파일이 있지만 계속 진행 (build context 영향 없음)" >&2
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" != "$MAIN_BRANCH" ]; then
	echo "[deploy-vps] ERROR: '$MAIN_BRANCH' 브랜치에서만 배포 가능 (현재: $CURRENT_BRANCH)" >&2
	exit 1
fi

git fetch origin "$MAIN_BRANCH" --quiet
LOCAL_HEAD="$(git rev-parse "$MAIN_BRANCH")"
REMOTE_HEAD="$(git rev-parse "origin/$MAIN_BRANCH")"
if [ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]; then
	echo "[deploy-vps] ERROR: 로컬과 origin/$MAIN_BRANCH 불일치 — 먼저 push 하세요." >&2
	echo "  local : $LOCAL_HEAD" >&2
	echo "  remote: $REMOTE_HEAD" >&2
	exit 1
fi
echo "[deploy-vps] preflight OK ($LOCAL_HEAD)"

# --- 2. db migrate ---------------------------------------------------------
# 새 ALTER ADD COLUMN / CREATE INDEX 를 prod D1 에 먼저 적용해야 신규 코드가 깨지지 않음.
# migrate.ts 는 idempotent — 이미 적용된 statement 는 skip 또는 dup 에러 흡수.
echo "[deploy-vps] step 2/6 — D1 schema migrate"
pnpm --filter @mookbot/core db:migrate

# --- 3. docker:release -----------------------------------------------------
echo "[deploy-vps] step 3/6 — docker build + push"
"$ROOT_DIR/scripts/docker-build.sh"
"$ROOT_DIR/scripts/docker-push.sh"

# --- 3. VPS pull + up ------------------------------------------------------
echo "[deploy-vps] step 4/6 — VPS pull + up -d ($VPS_HOST:$VPS_DIR)"
ssh -o ConnectTimeout=10 "$VPS_HOST" "cd $VPS_DIR && docker compose pull && docker compose up -d"

# --- 4. verify -------------------------------------------------------------
echo "[deploy-vps] step 5/6 — health 확인 (5s 대기 후)"
sleep 5
ssh -o ConnectTimeout=10 "$VPS_HOST" "cd $VPS_DIR && docker compose ps"

# --- 5. slash command 등록 -------------------------------------------------
# 새 컨테이너가 healthy 이후 등록 — Discord 가 새 이름 노출 시점에 봇이 이미
# 새 코드로 응답 가능하도록 (옛 컨테이너에 새 이름 띄우면 unknown command 응답).
# 명령어 변경 없는 release 라면 --skip-commands 로 1 API call 절약 (옵션).
if [ "$SKIP_COMMANDS" = "1" ]; then
	echo "[deploy-vps] step 6/6 — slash command 등록 skip (--skip-commands)"
else
	echo "[deploy-vps] step 6/6 — slash command 등록 (Discord)"
	pnpm --filter @mookbot/bot exec tsx src/deploy-commands.ts
fi

echo "[deploy-vps] ✓ done — v$VERSION 배포 완료"
