#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/carepoint}"
COMPOSE_FILE="${CAREPOINT_COMPOSE_FILE:-${INSTALL_DIR}/deploy/vps/docker-compose.yml}"
RUNTIME_ENV_FILE="${CAREPOINT_RUNTIME_ENV_FILE:-${INSTALL_DIR}/deploy/vps/.env}"
OUTPUT_FILE="${OUTPUT_FILE:-}"
DISK_CRITICAL_PERCENT="${CAREPOINT_DISK_CRITICAL_PERCENT:-90}"
MEMORY_CRITICAL_PERCENT="${CAREPOINT_MEMORY_CRITICAL_PERCENT:-95}"

fail() {
  echo "HEALTH CHECK FAILED: $*" >&2
  exit 1
}

env_value() {
  local key="$1"
  local line
  line=$(grep -E "^${key}=" "$RUNTIME_ENV_FILE" | tail -n 1 || true)
  printf '%s' "${line#*=}"
}

command -v docker >/dev/null 2>&1 || fail "docker is required"
command -v curl >/dev/null 2>&1 || fail "curl is required"
command -v df >/dev/null 2>&1 || fail "df is required"
[ -f "$COMPOSE_FILE" ] || fail "compose file not found: $COMPOSE_FILE"
[ -f "$RUNTIME_ENV_FILE" ] || fail "runtime configuration not found: $RUNTIME_ENV_FILE"
[[ "$DISK_CRITICAL_PERCENT" =~ ^[0-9]+$ ]] || fail "CAREPOINT_DISK_CRITICAL_PERCENT must be numeric"
[[ "$MEMORY_CRITICAL_PERCENT" =~ ^[0-9]+$ ]] || fail "CAREPOINT_MEMORY_CRITICAL_PERCENT must be numeric"

services=(postgres redis api admin provider patient-web provider-mobile-web python-worker-api python-worker-celery edge)
status=0
report=$(mktemp)
trap 'rm -f "$report"' EXIT

{
  printf 'carepoint_health_report_utc=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'release_sha=%s\n' "$(git -C "$INSTALL_DIR" rev-parse HEAD 2>/dev/null || printf unknown)"
  echo 'services:'
} > "$report"

for service in "${services[@]}"; do
  cid=$(docker compose -f "$COMPOSE_FILE" --env-file "$RUNTIME_ENV_FILE" ps -q "$service" 2>/dev/null || true)
  if [ -z "$cid" ]; then
    printf '  %s=missing\n' "$service" >> "$report"
    status=1
    continue
  fi

  state=$(docker inspect --format '{{.State.Status}}' "$cid" 2>/dev/null || printf unknown)
  health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}n/a{{end}}' "$cid" 2>/dev/null || printf unknown)
  restart_count=$(docker inspect --format '{{.RestartCount}}' "$cid" 2>/dev/null || printf unknown)
  oom_killed=$(docker inspect --format '{{.State.OOMKilled}}' "$cid" 2>/dev/null || printf unknown)
  printf '  %s=state:%s health:%s restarts:%s oom_killed:%s\n' "$service" "$state" "$health" "$restart_count" "$oom_killed" >> "$report"

  if [ "$state" != "running" ]; then
    status=1
  fi
  if [ "$health" != "n/a" ] && [ "$health" != "healthy" ]; then
    status=1
  fi
  if [ "$oom_killed" = "true" ]; then
    status=1
  fi
done

cpu_count=$(getconf _NPROCESSORS_ONLN 2>/dev/null || printf '1')
load_1m=$(awk '{print $1}' /proc/loadavg 2>/dev/null || printf 'unknown')
mem_total_kb=$(awk '/^MemTotal:/ {print $2}' /proc/meminfo 2>/dev/null || true)
mem_available_kb=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo 2>/dev/null || true)
memory_used_percent=unknown
if [[ "$mem_total_kb" =~ ^[0-9]+$ ]] && [[ "$mem_available_kb" =~ ^[0-9]+$ ]] && [ "$mem_total_kb" -gt 0 ]; then
  memory_used_percent=$(( (100 * (mem_total_kb - mem_available_kb)) / mem_total_kb ))
fi

disk_used_percent=$(df -P / | awk 'NR==2 {gsub(/%/, "", $5); print $5}')
[ -n "$disk_used_percent" ] || disk_used_percent=unknown

{
  echo 'host_resources:'
  printf '  cpu_count=%s\n' "$cpu_count"
  printf '  load_1m=%s\n' "$load_1m"
  printf '  memory_used_percent=%s threshold=%s\n' "$memory_used_percent" "$MEMORY_CRITICAL_PERCENT"
  printf '  root_disk_used_percent=%s threshold=%s\n' "$disk_used_percent" "$DISK_CRITICAL_PERCENT"
} >> "$report"

if [[ "$memory_used_percent" =~ ^[0-9]+$ ]] && [ "$memory_used_percent" -ge "$MEMORY_CRITICAL_PERCENT" ]; then
  status=1
fi
if [[ "$disk_used_percent" =~ ^[0-9]+$ ]] && [ "$disk_used_percent" -ge "$DISK_CRITICAL_PERCENT" ]; then
  status=1
fi

api_host=$(env_value CAREPOINT_API_HOST)
admin_host=$(env_value CAREPOINT_ADMIN_HOST)
provider_host=$(env_value CAREPOINT_PROVIDER_HOST)
patient_host=$(env_value CAREPOINT_PATIENT_HOST)
provider_mobile_host=$(env_value CAREPOINT_PROVIDER_MOBILE_HOST)

check_url() {
  local label="$1"
  local url="$2"
  if curl --fail --silent --show-error --location --max-time 10 "$url" >/dev/null; then
    printf '  %s=ok %s\n' "$label" "$url" >> "$report"
  else
    printf '  %s=failed %s\n' "$label" "$url" >> "$report"
    status=1
  fi
}

{
  echo 'public_endpoints:'
} >> "$report"

[ -n "$api_host" ] || fail "CAREPOINT_API_HOST is missing"
[ -n "$admin_host" ] || fail "CAREPOINT_ADMIN_HOST is missing"
[ -n "$provider_host" ] || fail "CAREPOINT_PROVIDER_HOST is missing"
[ -n "$patient_host" ] || fail "CAREPOINT_PATIENT_HOST is missing"
[ -n "$provider_mobile_host" ] || fail "CAREPOINT_PROVIDER_MOBILE_HOST is missing"

check_url api_livez "https://${api_host}/livez"
check_url api_readyz "https://${api_host}/readyz"
check_url admin "https://${admin_host}/"
check_url provider "https://${provider_host}/"
check_url patient "https://${patient_host}/"
check_url provider_mobile "https://${provider_mobile_host}/"

cat "$report"
if [ -n "$OUTPUT_FILE" ]; then
  install -m 600 "$report" "$OUTPUT_FILE"
  echo "Health report written to $OUTPUT_FILE"
fi

if [ "$status" -ne 0 ]; then
  exit 1
fi
