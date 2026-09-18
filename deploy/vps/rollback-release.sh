#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/carepoint}"
COMPOSE_FILE="${CAREPOINT_COMPOSE_FILE:-${INSTALL_DIR}/deploy/vps/docker-compose.yml}"
RUNTIME_ENV_FILE="${CAREPOINT_RUNTIME_ENV_FILE:-${INSTALL_DIR}/deploy/vps/.env}"
ROLLBACK_SHA="${ROLLBACK_SHA:-}"
EXPECTED_CURRENT_SHA="${EXPECTED_CURRENT_SHA:-}"
BRANCH="${CAREPOINT_BRANCH:-release/v1-go-live}"

fail() {
  echo "ROLLBACK FAILED: $*" >&2
  exit 1
}

[ -d "${INSTALL_DIR}/.git" ] || fail "git checkout not found at $INSTALL_DIR"
[ -f "$COMPOSE_FILE" ] || fail "compose file not found: $COMPOSE_FILE"
[ -f "$RUNTIME_ENV_FILE" ] || fail "runtime configuration not found: $RUNTIME_ENV_FILE"
[ -f "${INSTALL_DIR}/deploy/vps/backup-postgres.sh" ] || fail "backup helper is missing"
[ -f "${INSTALL_DIR}/deploy/vps/health-report.sh" ] || fail "health helper is missing"
[[ "$ROLLBACK_SHA" =~ ^[0-9a-fA-F]{40}$ ]] || fail "ROLLBACK_SHA must be a full 40-character commit SHA"
[[ "$EXPECTED_CURRENT_SHA" =~ ^[0-9a-fA-F]{40}$ ]] || fail "EXPECTED_CURRENT_SHA must be a full 40-character commit SHA"

cd "$INSTALL_DIR"
current_sha=$(git rev-parse HEAD)
[ "$current_sha" = "$EXPECTED_CURRENT_SHA" ] || fail "current SHA $current_sha does not match EXPECTED_CURRENT_SHA"
[ -z "$(git status --porcelain)" ] || fail "working tree must be clean before rollback"

git fetch --prune origin "$BRANCH"
git cat-file -e "${ROLLBACK_SHA}^{commit}" 2>/dev/null || fail "ROLLBACK_SHA is not available locally after fetch"
git merge-base --is-ancestor "$ROLLBACK_SHA" "$current_sha" || fail "ROLLBACK_SHA must be an ancestor of the currently deployed SHA"

# Preserve the current release health verifier before switching to a target SHA
# that may predate this helper.
ops_tmp=$(mktemp -d)
trap 'rm -rf "$ops_tmp"' EXIT
cp "${INSTALL_DIR}/deploy/vps/health-report.sh" "${ops_tmp}/health-report.sh"
chmod 700 "${ops_tmp}/health-report.sh"

# Capture a database backup before changing application code. The backup helper
# does not print credentials and validates the resulting archive.
INSTALL_DIR="$INSTALL_DIR" \
CAREPOINT_COMPOSE_FILE="$COMPOSE_FILE" \
CAREPOINT_RUNTIME_ENV_FILE="$RUNTIME_ENV_FILE" \
bash "${INSTALL_DIR}/deploy/vps/backup-postgres.sh"

echo "Rolling back CarePoint from $current_sha to $ROLLBACK_SHA"
git checkout --detach "$ROLLBACK_SHA"
[ -z "$(git status --porcelain)" ] || fail "working tree is not clean at rollback SHA"

[ -f "${INSTALL_DIR}/deploy/vps/preflight.sh" ] || fail "rollback target does not contain the release preflight"
[ -f "${INSTALL_DIR}/deploy/vps/docker-compose.yml" ] || fail "rollback target does not contain the VPS compose file"

# A detached checkout is intentional during rollback. All other release
# preflight invariants remain mandatory.
INSTALL_DIR="$INSTALL_DIR" \
CAREPOINT_BRANCH=HEAD \
CAREPOINT_RUNTIME_ENV_FILE="$RUNTIME_ENV_FILE" \
EXPECTED_RELEASE_SHA="$ROLLBACK_SHA" \
bash "${INSTALL_DIR}/deploy/vps/preflight.sh"

docker compose -f "$COMPOSE_FILE" --env-file "$RUNTIME_ENV_FILE" build
docker compose -f "$COMPOSE_FILE" --env-file "$RUNTIME_ENV_FILE" up -d

INSTALL_DIR="$INSTALL_DIR" \
CAREPOINT_COMPOSE_FILE="$COMPOSE_FILE" \
CAREPOINT_RUNTIME_ENV_FILE="$RUNTIME_ENV_FILE" \
bash "${ops_tmp}/health-report.sh"

echo "Rollback verified at $ROLLBACK_SHA"
echo "Previous deployed SHA was $current_sha"
