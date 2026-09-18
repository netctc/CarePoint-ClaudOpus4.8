#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/carepoint}"
COMPOSE_FILE="${CAREPOINT_COMPOSE_FILE:-${INSTALL_DIR}/deploy/vps/docker-compose.yml}"
RUNTIME_ENV_FILE="${CAREPOINT_RUNTIME_ENV_FILE:-${INSTALL_DIR}/deploy/vps/.env}"
BACKUP_FILE="${BACKUP_FILE:-}"
RESTORE_DATABASE="${RESTORE_DATABASE:-care_center_restore_drill}"
KEEP_RESTORE_DATABASE="${KEEP_RESTORE_DATABASE:-false}"
ALLOW_IN_PLACE_RESTORE="${ALLOW_IN_PLACE_RESTORE:-false}"

fail() {
  echo "RESTORE FAILED: $*" >&2
  exit 1
}

env_value() {
  local key="$1"
  local line
  line=$(grep -E "^${key}=" "$RUNTIME_ENV_FILE" | tail -n 1 || true)
  printf '%s' "${line#*=}"
}

command -v docker >/dev/null 2>&1 || fail "docker is required"
[ -f "$COMPOSE_FILE" ] || fail "compose file not found: $COMPOSE_FILE"
[ -f "$RUNTIME_ENV_FILE" ] || fail "runtime configuration not found: $RUNTIME_ENV_FILE"
[ -n "$BACKUP_FILE" ] || fail "BACKUP_FILE is required"
[ -f "$BACKUP_FILE" ] || fail "backup file not found: $BACKUP_FILE"
[[ "$RESTORE_DATABASE" =~ ^[A-Za-z0-9_]+$ ]] || fail "RESTORE_DATABASE may contain only letters, numbers and underscore"

POSTGRES_USER=$(env_value POSTGRES_USER)
LIVE_DATABASE=$(env_value POSTGRES_DB)
[ -n "$POSTGRES_USER" ] || fail "POSTGRES_USER is missing"
[ -n "$LIVE_DATABASE" ] || fail "POSTGRES_DB is missing"

if [ "$RESTORE_DATABASE" = "$LIVE_DATABASE" ] && [ "$ALLOW_IN_PLACE_RESTORE" != "true" ]; then
  fail "refusing in-place restore; use an isolated database or explicitly set ALLOW_IN_PLACE_RESTORE=true"
fi

# Validate archive structure before touching any database.
docker compose -f "$COMPOSE_FILE" --env-file "$RUNTIME_ENV_FILE" exec -T postgres \
  pg_restore --list < "$BACKUP_FILE" >/dev/null

docker compose -f "$COMPOSE_FILE" --env-file "$RUNTIME_ENV_FILE" exec -T postgres \
  psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS \"${RESTORE_DATABASE}\" WITH (FORCE);" >/dev/null

docker compose -f "$COMPOSE_FILE" --env-file "$RUNTIME_ENV_FILE" exec -T postgres \
  psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE DATABASE \"${RESTORE_DATABASE}\";" >/dev/null

docker compose -f "$COMPOSE_FILE" --env-file "$RUNTIME_ENV_FILE" exec -T postgres \
  pg_restore -U "$POSTGRES_USER" -d "$RESTORE_DATABASE" --no-owner --no-privileges --exit-on-error < "$BACKUP_FILE"

table_count=$(docker compose -f "$COMPOSE_FILE" --env-file "$RUNTIME_ENV_FILE" exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$RESTORE_DATABASE" -At -v ON_ERROR_STOP=1 \
  -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" | tr -d '[:space:]')

[[ "$table_count" =~ ^[0-9]+$ ]] || fail "could not verify restored table count"
[ "$table_count" -gt 0 ] || fail "restored database contains no public tables"

migration_table=$(docker compose -f "$COMPOSE_FILE" --env-file "$RUNTIME_ENV_FILE" exec -T postgres \
  psql -U "$POSTGRES_USER" -d "$RESTORE_DATABASE" -At -v ON_ERROR_STOP=1 \
  -c "SELECT to_regclass('public._prisma_migrations') IS NOT NULL;" | tr -d '[:space:]')
[ "$migration_table" = "t" ] || fail "restored database is missing _prisma_migrations"

echo "Restore drill verified: database=${RESTORE_DATABASE}, public_tables=${table_count}"

if [ "$KEEP_RESTORE_DATABASE" != "true" ] && [ "$RESTORE_DATABASE" != "$LIVE_DATABASE" ]; then
  docker compose -f "$COMPOSE_FILE" --env-file "$RUNTIME_ENV_FILE" exec -T postgres \
    psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE \"${RESTORE_DATABASE}\" WITH (FORCE);" >/dev/null
  echo "Isolated restore database removed after successful verification."
else
  echo "Restore database retained for operator inspection."
fi
