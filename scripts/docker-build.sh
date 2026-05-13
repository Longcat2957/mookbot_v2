#!/usr/bin/env bash
# 루트 package.json 버전을 읽어서 3개 이미지를 X.Y.Z + latest 두 태그로 빌드.
# 사용: pnpm docker:build  또는  scripts/docker-build.sh [--sequential]
#
# v0.13.x:
#   - 3 이미지 병렬 build (& + wait). 빌드 로그는 임시 파일로 분리. 실패한 빌드만
#     stdout 으로 dump (성공 로그는 buildx progress 가 길어서 noise).
#   - Dockerfile 의 `--mount=type=cache` 로 pnpm store 호스트 캐시 공유.
#     DOCKER_BUILDKIT=1 (Docker 20.10+ 기본값) 필요.
#   - --sequential 옵션으로 옛 순차 흐름 강제 가능 (디버깅 / 리소스 부족 시).

set -euo pipefail

PARALLEL=1
for arg in "$@"; do
	case "$arg" in
		--sequential) PARALLEL=0 ;;
		*) echo "[docker-build] ERROR: unknown arg '$arg' (지원: --sequential)" >&2; exit 1 ;;
	esac
done

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
echo "[docker-build] mode: $([ $PARALLEL -eq 1 ] && echo parallel || echo sequential)"

build_one() {
	local name="$1"
	local short="${name#mookbot-}"
	local dockerfile="apps/$short/Dockerfile"
	local build_args=()

	if [ "$short" = "activity" ]; then
		build_args+=("--build-arg" "VITE_DISCORD_CLIENT_ID=$CLIENT_ID_VAL")
	fi

	docker build \
		-f "$dockerfile" \
		-t "$REGISTRY/$name:$VERSION" \
		-t "$REGISTRY/$name:latest" \
		"${build_args[@]}" \
		.
}

if [ $PARALLEL -eq 1 ]; then
	TMPDIR="$(mktemp -d)"
	trap 'rm -rf "$TMPDIR"' EXIT
	declare -A PIDS
	for img in "${IMAGES[@]}"; do
		(build_one "$img") >"$TMPDIR/$img.log" 2>&1 &
		PIDS[$img]=$!
		echo "[docker-build] started $img (pid ${PIDS[$img]})"
	done
	FAILED=()
	for img in "${IMAGES[@]}"; do
		if wait "${PIDS[$img]}"; then
			echo "[docker-build] ✓ $img done"
		else
			echo "[docker-build] ✗ $img FAILED"
			FAILED+=("$img")
		fi
	done
	for img in "${FAILED[@]}"; do
		echo "============== $img log =============="
		cat "$TMPDIR/$img.log"
	done
	if [ "${#FAILED[@]}" -gt 0 ]; then
		echo "[docker-build] ERROR: ${#FAILED[@]} build(s) failed" >&2
		exit 1
	fi
else
	for img in "${IMAGES[@]}"; do
		echo "[docker-build] building $REGISTRY/$img:$VERSION"
		build_one "$img"
	done
fi

echo "[docker-build] done — built ${#IMAGES[@]} images at $VERSION + latest"
