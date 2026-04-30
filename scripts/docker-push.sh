#!/usr/bin/env bash
# 빌드된 이미지를 X.Y.Z + latest 두 태그로 push.
# 사용: pnpm docker:push  또는  scripts/docker-push.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

VERSION="$(node -p "require('./package.json').version")"
REGISTRY="longcat1132"
IMAGES=("mookbot-api" "mookbot-bot" "mookbot-activity")

echo "[docker-push] version: $VERSION"

for img in "${IMAGES[@]}"; do
	echo "[docker-push] pushing $REGISTRY/$img:$VERSION"
	docker push "$REGISTRY/$img:$VERSION"
	echo "[docker-push] pushing $REGISTRY/$img:latest"
	docker push "$REGISTRY/$img:latest"
done

echo "[docker-push] done — pushed ${#IMAGES[@]} images at $VERSION + latest"
