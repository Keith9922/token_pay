#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

if [ ! -f "$REPO_ROOT/dist/src/cli.js" ]; then
  (cd "$REPO_ROOT" && npm run build >/dev/null)
fi

cd "$REPO_ROOT"
node dist/src/cli.js dashboard "$@"

