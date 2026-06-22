#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(pwd)}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

"$SCRIPT_DIR/01-normalize-repo.sh" "$ROOT"
"$SCRIPT_DIR/02-build-backend-and-contracts.sh" "$ROOT"
"$SCRIPT_DIR/03-implement-auth-rbac.sh" "$ROOT"
"$SCRIPT_DIR/04-enable-core-workflows.sh" "$ROOT"

printf '\n[bootstrap] All steps completed for %s\n' "$ROOT"
