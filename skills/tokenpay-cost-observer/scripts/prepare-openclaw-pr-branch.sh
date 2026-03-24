#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT_DIR"

if [ ! -d dist ]; then
  npm run build >/dev/null
fi

REPO_PATH=""
BRANCH_NAME="tokenpay/feishu-note-cost"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --repo)
      REPO_PATH="${2:-}"
      shift 2
      ;;
    --branch)
      BRANCH_NAME="${2:-}"
      shift 2
      ;;
    *)
      echo "未知参数: $1" >&2
      exit 1
      ;;
  esac
done

if [ -z "$REPO_PATH" ]; then
  echo "需要 --repo /path/to/openclaw" >&2
  exit 1
fi

git -C "$REPO_PATH" checkout -b "$BRANCH_NAME"
node dist/src/cli.js openclaw-patch --repo "$REPO_PATH" --mode pr
echo "已准备 OpenClaw PR 分支: $BRANCH_NAME"
