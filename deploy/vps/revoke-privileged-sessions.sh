#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/carepoint}"
COMPOSE_FILE="${CAREPOINT_COMPOSE_FILE:-${INSTALL_DIR}/deploy/vps/docker-compose.yml}"
RUNTIME_ENV_FILE="${CAREPOINT_RUNTIME_ENV_FILE:-${INSTALL_DIR}/deploy/vps/.env}"
CONFIRM_VALUE="${CONFIRM_REVOKE_PRIVILEGED_SESSIONS:-}"

fail() {
  echo "PRIVILEGED SESSION REVOCATION FAILED: $*" >&2
  exit 1
}

command -v docker >/dev/null 2>&1 || fail "docker is required"
[ -f "$COMPOSE_FILE" ] || fail "compose file not found: $COMPOSE_FILE"
[ -f "$RUNTIME_ENV_FILE" ] || fail "runtime configuration not found: $RUNTIME_ENV_FILE"

db_service_id=$(docker compose -f "$COMPOSE_FILE" --env-file "$RUNTIME_ENV_FILE" ps -q postgres 2>/dev/null || true)
[ -n "$db_service_id" ] || fail "postgres service is not running"

run_sql() {
  local sql="$1"
  docker compose -f "$COMPOSE_FILE" --env-file "$RUNTIME_ENV_FILE" exec -T postgres \
    sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA -c "$1"' sh "$sql"
}

privileged_roles="'SUPER_ADMIN','COMPANY_ADMIN','COMPANY_SUPPORT','PROVIDER','NURSE','PHARMACIST','LAB_TECH','FINANCE'"

active_count=$(run_sql "SELECT count(*) FROM \"RefreshToken\" rt JOIN \"User\" u ON u.id = rt.\"userId\" WHERE rt.\"revokedAt\" IS NULL AND rt.\"expiresAt\" > NOW() AND u.role::text IN (${privileged_roles});")
active_count=$(printf '%s' "$active_count" | tr -d '[:space:]')
[[ "$active_count" =~ ^[0-9]+$ ]] || fail "could not determine active privileged refresh-token count"

echo "Active privileged refresh tokens: ${active_count}"

if [ "$CONFIRM_VALUE" != "REVOKE_PRIVILEGED_SESSIONS" ]; then
  echo "Dry run only. No tokens were changed."
  echo "To revoke them during the MFA cutover, rerun with CONFIRM_REVOKE_PRIVILEGED_SESSIONS=REVOKE_PRIVILEGED_SESSIONS."
  exit 0
fi

if [ "$active_count" -eq 0 ]; then
  echo "No active privileged refresh tokens require revocation."
  exit 0
fi

revoked_count=$(run_sql "WITH revoked AS (UPDATE \"RefreshToken\" rt SET \"revokedAt\" = NOW() FROM \"User\" u WHERE rt.\"userId\" = u.id AND rt.\"revokedAt\" IS NULL AND rt.\"expiresAt\" > NOW() AND u.role::text IN (${privileged_roles}) RETURNING rt.id) SELECT count(*) FROM revoked;")
revoked_count=$(printf '%s' "$revoked_count" | tr -d '[:space:]')
[[ "$revoked_count" =~ ^[0-9]+$ ]] || fail "revocation completed but the affected-row count could not be verified"

echo "Revoked privileged refresh tokens: ${revoked_count}"
remaining_count=$(run_sql "SELECT count(*) FROM \"RefreshToken\" rt JOIN \"User\" u ON u.id = rt.\"userId\" WHERE rt.\"revokedAt\" IS NULL AND rt.\"expiresAt\" > NOW() AND u.role::text IN (${privileged_roles});")
remaining_count=$(printf '%s' "$remaining_count" | tr -d '[:space:]')
[ "$remaining_count" = "0" ] || fail "active privileged refresh tokens remain after revocation: ${remaining_count}"

echo "Verification passed: no active privileged refresh tokens remain."
echo "Existing short-lived access tokens are not stored server-side; wait at least one configured access-token TTL before opening privileged pilot access."
