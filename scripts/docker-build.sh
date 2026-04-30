#!/usr/bin/env bash
# 루트 package.json 버전을 읽어서 3개 이미지를 X.Y.Z + latest 두 태그로 빌드.
# 사용: pnpm docker:build  또는  scripts/docker-build.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

VERSION="$(node -p "require('./package.json').version")"
REGISTRY="longcat1132"
IMAGES=("mookbot-api" "mookbot-bot" "mookbot-activity")

if [ -z "${VERSION:-}" ] || [ "$VERSION" = "undefined" ]; then
	echo "[docker-build] ERROR: package.json version not found" >&2
	exit 1
fi

# Activity 빌드 시 필요한 VITE_DISCORD_CLIENT_ID — 루트 .env 에서 읽음 (없으면 빈 값)
CLIENT_ID_VAL=""
if [ -f "$ROOT_DIR/.env" ]; then
	CLIENT_ID_VAL="$(grep '^CLIENT_ID=' "$ROOT_DIR/.env" | head -1 | cut -d= -f2- || true)"
fi

echo "[docker-build] version: $VERSION"
echo "[docker-build] registry: $REGISTRY"

build_one() {
	local name="$1"
	local short="${name#mookbot-}"
	local dockerfile="apps/$short/Dockerfile"
	local build_args=()

	if [ "$short" = "activity" ]; then
		build_args+=("--build-arg" "VITE_DISCORD_CLIENT_ID=$CLIENT_ID_VAL")
	fi

	echo "[docker-build] building $REGISTRY/$name:$VERSION"
	docker build \
		-f "$dockerfile" \
		-t "$REGISTRY/$name:$VERSION" \
		-t "$REGISTRY/$name:latest" \
		"${build_args[@]}" \
		.
}

for img in "${IMAGES[@]}"; do
	build_one "$img"
done

echo "[docker-build] done — built ${#IMAGES[@]} images at $VERSION + latest"
