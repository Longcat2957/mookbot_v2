#!/usr/bin/env bash
# 로컬에서 commit/push 끝난 상태로 VPS 까지 한 번에 배포.
# 사용: pnpm deploy:vps  또는  scripts/deploy-vps.sh
#
# 시퀀스:
#   1. preflight  — working tree clean + main 과 origin/main sync 확인
#   2. docker:release  — 3개 이미지 build + push (X.Y.Z + latest)
#   3. VPS pull + up -d  — ssh root@141.164.46.191 로 적용
#   4. health verify  — 컨테이너 상태 출력
#
# 가정:
#   - 변경분 commit + git push origin main 이 이미 완료됨
#   - VPS 호스트: root@141.164.46.191, 배포 dir: /root/deploy

set -euo pipefail

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

# --- 2. docker:release -----------------------------------------------------
echo "[deploy-vps] step 2/4 — docker build + push"
"$ROOT_DIR/scripts/docker-build.sh"
"$ROOT_DIR/scripts/docker-push.sh"

# --- 3. VPS pull + up ------------------------------------------------------
echo "[deploy-vps] step 3/4 — VPS pull + up -d ($VPS_HOST:$VPS_DIR)"
ssh -o ConnectTimeout=10 "$VPS_HOST" "cd $VPS_DIR && docker compose pull && docker compose up -d"

# --- 4. verify -------------------------------------------------------------
echo "[deploy-vps] step 4/4 — health 확인 (5s 대기 후)"
sleep 5
ssh -o ConnectTimeout=10 "$VPS_HOST" "cd $VPS_DIR && docker compose ps"

echo "[deploy-vps] ✓ done — v$VERSION 배포 완료"
