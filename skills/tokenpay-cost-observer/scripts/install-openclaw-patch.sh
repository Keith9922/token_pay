#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT_DIR"

if [ ! -d dist ]; then
  npm run build >/dev/null
fi

node dist/src/cli.js openclaw-patch "$@"
