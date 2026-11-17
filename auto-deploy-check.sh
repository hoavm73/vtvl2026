#!/bin/bash
# Tự động kiểm tra commit mới trên hoavm73/vtvl2026 (nhánh main) và kích hoạt ./deploy.sh
set -e

WORK_DIR="/root/ute.vtvl"
cd "$WORK_DIR" || exit 0

[ -d .git ] || exit 0

git fetch origin main --quiet || exit 0

REMOTE_SHA=$(git rev-parse origin/main 2>/dev/null || true)
DEPLOYED_SHA=$(cat .deployed_sha 2>/dev/null || git rev-parse HEAD 2>/dev/null || true)

if [ -n "$REMOTE_SHA" ] && [ "$REMOTE_SHA" != "$DEPLOYED_SHA" ]; then
  echo "[$(date -Iseconds)] Phát hiện commit mới trên hoavm73/vtvl2026 ($DEPLOYED_SHA -> $REMOTE_SHA). Bắt đầu auto-deploy..."
  bash "$WORK_DIR/deploy.sh"
fi

