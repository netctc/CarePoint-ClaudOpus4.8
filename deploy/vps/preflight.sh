#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${INSTALL_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
COMPOSE_FILE="${CAREPOINT_COMPOSE_FILE:-${ROOT_DIR}/deploy/vps/docker-compose.yml}"
RUNTIME_ENV_FILE="${CAREPOINT_RUNTIME_ENV_FILE:-${ROOT_DIR}/deploy/vps/.env}"
EXPECTED_RELEASE_SHA="${EXPECTED_RELEASE_SHA:-}"
REQUIRED_BRANCH="${CAREPOINT_BRANCH:-release/v1-go-live}"

fail() {
    echo "PRECHECK FAILED: $*" >&2
    exit 1
}

ok() {
    echo "[OK] $*"
}

need_command() {
    command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

env_value() {
    local key="$1"
    local line
    line=$(grep -E "^${key}=" "${RUNTIME_ENV_FILE}" | tail -n 1 || true)
    printf '%s' "${line#*=}"
}

require_nonempty() {
    local key="$1"
    local value
    value=$(env_value "$key")
    [ -n "$value" ] || fail "required runtime variable is empty: ${key}"
}

require_exact() {
    local key="$1"
    local expected="$2"
    local value
    value=$(env_value "$key")
    [ "$value" = "$expected" ] || fail "${key} must be ${expected}"
}

require_https() {
    local key="$1"
    local value
    value=$(env_value "$key")
    [[ "$value" == https://* ]] || fail "${key} must use https://"
    [[ "$value" != *localhost* && "$value" != *127.0.0.1* ]] || fail "${key} cannot target localhost in release mode"
}

require_secret_length() {
    local key="$1"
    local minimum="${2:-32}"
    local value
    value=$(env_value "$key")
    [ "${#value}" -ge "$minimum" ] || fail "${key} must be at least ${minimum} characters"
}

require_hostname() {
    local key="$1"
    local value
    value=$(env_value "$key")
    [ -n "$value" ] || fail "${key} is required"
    [[ "$value" != http://* && "$value" != https://* && "$value" != */* ]] || fail "${key} must be a hostname only"
    [[ "$value" == *.* ]] || fail "${key} must be a resolvable FQDN"
    [[ "$value" != localhost && "$value" != *.localhost ]] || fail "${key} cannot use localhost"
    getent ahosts "$value" >/dev/null 2>&1 || fail "DNS does not resolve for ${key} (${value})"
}

need_command docker
need_command git
need_command curl
need_command getent

[ -f "$COMPOSE_FILE" ] || fail "compose file not found: ${COMPOSE_FILE}"
[ -f "$RUNTIME_ENV_FILE" ] || fail "runtime configuration not found: ${RUNTIME_ENV_FILE}"

if command -v stat >/dev/null 2>&1; then
    mode=$(stat -c '%a' "$RUNTIME_ENV_FILE" 2>/dev/null || true)
    [ -z "$mode" ] || [ "$mode" = "600" ] || fail "runtime configuration must have file mode 600 (observed ${mode})"
fi
ok "runtime configuration exists with protected permissions"

cd "$ROOT_DIR"
current_branch=$(git rev-parse --abbrev-ref HEAD)
[ "$current_branch" = "$REQUIRED_BRANCH" ] || fail "expected branch ${REQUIRED_BRANCH}, observed ${current_branch}"
current_sha=$(git rev-parse HEAD)
[ -n "$EXPECTED_RELEASE_SHA" ] || fail "EXPECTED_RELEASE_SHA is required for a pinned release deployment"
[ "$current_sha" = "$EXPECTED_RELEASE_SHA" ] || fail "checked-out SHA does not match EXPECTED_RELEASE_SHA"
[ -z "$(git status --porcelain)" ] || fail "working tree must be clean before deployment"
ok "release branch and immutable SHA are pinned"

require_exact NODE_ENV production
require_exact ALLOW_LOCALHOST_CORS_WILDCARD false
require_exact ALLOW_AUDIT_FALLBACK_IN_PRODUCTION false
require_exact NEXT_PUBLIC_ALLOW_DEMO_SIGNIN false

for key in \
    CAREPOINT_API_HOST \
    CAREPOINT_ADMIN_HOST \
    CAREPOINT_PROVIDER_HOST \
    CAREPOINT_PATIENT_HOST \
    CAREPOINT_PROVIDER_MOBILE_HOST; do
    require_hostname "$key"
done

require_nonempty ACME_EMAIL
require_https FRONTEND_ADMIN_URL
require_https FRONTEND_PROVIDER_URL
require_https FRONTEND_PATIENT_URL
require_https FRONTEND_PROVIDER_MOBILE_URL
require_https NEXT_PUBLIC_API_BASE_URL
require_https PATIENT_API_BASE_URL
require_https PROVIDER_MOBILE_API_BASE_URL

allowed_origins=$(env_value FRONTEND_ALLOWED_ORIGINS)
[ -n "$allowed_origins" ] || fail "FRONTEND_ALLOWED_ORIGINS is required"
[[ "$allowed_origins" != *localhost* && "$allowed_origins" != *127.0.0.1* && "$allowed_origins" != *"*"* ]] || fail "FRONTEND_ALLOWED_ORIGINS cannot contain localhost, loopback, or wildcard entries"
IFS=',' read -r -a origin_list <<< "$allowed_origins"
[ "${#origin_list[@]}" -eq 4 ] || fail "FRONTEND_ALLOWED_ORIGINS must contain exactly the four release portal origins"
for origin in "${origin_list[@]}"; do
    [[ "$origin" == https://* ]] || fail "every FRONTEND_ALLOWED_ORIGINS entry must use https://"
done
ok "production CORS and public URL policy is strict"

for key in \
    POSTGRES_PASSWORD \
    REDIS_PASSWORD \
    JWT_ACCESS_SECRET \
    JWT_REFRESH_SECRET \
    MEDICAL_PROFILE_ENCRYPTION_KEY \
    PYTHON_SERVICES_SHARED_SECRET; do
    require_secret_length "$key" 32
done
ok "required runtime secrets are present with minimum length; values were not printed"

require_nonempty DATABASE_URL
require_nonempty DIRECT_URL
require_nonempty REDIS_URL
require_nonempty CELERY_BROKER_URL
require_nonempty CELERY_RESULT_BACKEND

if ! docker compose -f "$COMPOSE_FILE" --env-file "$RUNTIME_ENV_FILE" config --quiet; then
    fail "docker compose configuration validation failed"
fi
ok "docker compose configuration is valid"

echo "Release preflight passed for ${current_sha}."
