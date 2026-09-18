#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/carepoint}"
COMPOSE_FILE="${CAREPOINT_COMPOSE_FILE:-${INSTALL_DIR}/deploy/vps/docker-compose.yml}"
RUNTIME_ENV_FILE="${CAREPOINT_RUNTIME_ENV_FILE:-${INSTALL_DIR}/deploy/vps/.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/carepoint/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

fail() {
  echo "BACKUP FAILED: $*" >&2
  exit 1
}

env_value() {
  local key="$1"
  local line
  line=$(grep -E "^${key}=" "$RUNTIME_ENV_FILE" | tail -n 1 || true)
  printf '%s' "${line#*=}"
}

command -v docker >/dev/null 2>&1 || fail "docker is required"
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum is required"
[ -f "$COMPOSE_FILE" ] || fail "compose file not found: $COMPOSE_FILE"
[ -f "$RUNTIME_ENV_FILE" ] || fail "runtime configuration not found: $RUNTIME_ENV_FILE"
[[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || fail "RETENTION_DAYS must be a non-negative integer"

POSTGRES_USER=$(env_value POSTGRES_USER)
POSTGRES_DB=$(env_value POSTGRES_DB)
[ -n "$POSTGRES_USER" ] || fail "POSTGRES_USER is missing"
[ -n "$POSTGRES_DB" ] || fail "POSTGRES_DB is missing"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
release_sha=$(git -C "$INSTALL_DIR" rev-parse HEAD 2>/dev/null || printf 'unknown')
final_file="${BACKUP_DIR}/carepoint-${POSTGRES_DB}-${timestamp}-${release_sha:0:12}.dump"
tmp_file=$(mktemp "${BACKUP_DIR}/.carepoint-backup-XXXXXX.dump")
trap 'rm -f "$tmp_file"' EXIT

# Credentials remain inside the already-running PostgreSQL container. No secret
# value is printed or embedded in the backup filename/metadata.
docker compose -f "$COMPOSE_FILE" --env-file "$RUNTIME_ENV_FILE" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl > "$tmp_file"

[ -s "$tmp_file" ] || fail "pg_dump produced an empty backup"
docker compose -f "$COMPOSE_FILE" --env-file "$RUNTIME_ENV_FILE" exec -T postgres \
  pg_restore --list < "$tmp_file" >/dev/null

chmod 600 "$tmp_file"
mv "$tmp_file" "$final_file"
trap - EXIT

checksum=$(sha256sum "$final_file" | awk '{print $1}')
size_bytes=$(stat -c '%s' "$final_file" 2>/dev/null || wc -c < "$final_file")
metadata_file="${final_file}.meta"
{
  printf 'created_at_utc=%s\n' "$timestamp"
  printf 'release_sha=%s\n' "$release_sha"
  printf 'database=%s\n' "$POSTGRES_DB"
  printf 'size_bytes=%s\n' "$size_bytes"
  printf 'sha256=%s\n' "$checksum"
} > "$metadata_file"
chmod 600 "$metadata_file"

if [ "$RETENTION_DAYS" -gt 0 ]; then
  find "$BACKUP_DIR" -type f \( -name 'carepoint-*.dump' -o -name 'carepoint-*.dump.meta' \) -mtime "+$RETENTION_DAYS" -delete
fi

echo "Backup complete: $final_file"
echo "SHA256: $checksum"
echo "Retention window: ${RETENTION_DAYS} days"
