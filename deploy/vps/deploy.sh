#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# CarePoint VPS Deployment Script
# Controlled v1 deployment for a single VPS using Docker Compose + Caddy TLS.
# Run ON the target VPS as root.
#
# Required non-secret inputs:
#   EXPECTED_RELEASE_SHA=<full commit sha>
#   CAREPOINT_API_HOST=api.example.com
#   CAREPOINT_ADMIN_HOST=admin.example.com
#   CAREPOINT_PROVIDER_HOST=provider.example.com
#   CAREPOINT_PATIENT_HOST=patient.example.com
#   CAREPOINT_PROVIDER_MOBILE_HOST=provider-mobile.example.com
#   ACME_EMAIL=ops@example.com
#
# Optional:
#   CAREPOINT_BRANCH=release/v1-go-live
#   INSTALL_DIR=/opt/carepoint
#   REPO_URL=https://github.com/netctc/CarePoint-ClaudOpus4.8.git
#
# Runtime credentials are generated only on first install and are preserved on
# redeploy. Secret rotation is a separate deliberate operation. In particular,
# never rotate MEDICAL_PROFILE_ENCRYPTION_KEY implicitly.
# =============================================================================

if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: run this deployment script as root." >&2
    exit 1
fi

REPO_URL="${REPO_URL:-https://github.com/netctc/CarePoint-ClaudOpus4.8.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/carepoint}"
BRANCH="${CAREPOINT_BRANCH:-release/v1-go-live}"
EXPECTED_RELEASE_SHA="${EXPECTED_RELEASE_SHA:-}"
RUNTIME_ENV_FILE="${INSTALL_DIR}/deploy/vps/.env"
COMPOSE_FILE="${INSTALL_DIR}/deploy/vps/docker-compose.yml"

CAREPOINT_API_HOST="${CAREPOINT_API_HOST:-}"
CAREPOINT_ADMIN_HOST="${CAREPOINT_ADMIN_HOST:-}"
CAREPOINT_PROVIDER_HOST="${CAREPOINT_PROVIDER_HOST:-}"
CAREPOINT_PATIENT_HOST="${CAREPOINT_PATIENT_HOST:-}"
CAREPOINT_PROVIDER_MOBILE_HOST="${CAREPOINT_PROVIDER_MOBILE_HOST:-}"
ACME_EMAIL="${ACME_EMAIL:-}"

POSTGRES_DB="${POSTGRES_DB:-care_center}"
POSTGRES_USER="${POSTGRES_USER:-carecenter}"

fail() {
    echo "ERROR: $*" >&2
    exit 1
}

require_input() {
    local name="$1"
    local value="$2"
    [ -n "$value" ] || fail "${name} is required"
}

validate_hostname() {
    local name="$1"
    local value="$2"
    [[ "$value" == *.* ]] || fail "${name} must be an FQDN"
    [[ "$value" != http://* && "$value" != https://* && "$value" != */* ]] || fail "${name} must contain a hostname only"
    [[ "$value" != localhost && "$value" != *.localhost ]] || fail "${name} cannot be localhost"
}

upsert_runtime_value() {
    local key="$1"
    local value="$2"
    local tmp
    tmp=$(mktemp)
    awk -v key="$key" -v value="$value" '
        BEGIN { updated = 0 }
        index($0, key "=") == 1 {
            if (!updated) {
                print key "=" value
                updated = 1
            }
            next
        }
        { print }
        END {
            if (!updated) print key "=" value
        }
    ' "$RUNTIME_ENV_FILE" > "$tmp"
    install -m 600 "$tmp" "$RUNTIME_ENV_FILE"
    rm -f "$tmp"
}

require_input EXPECTED_RELEASE_SHA "$EXPECTED_RELEASE_SHA"
require_input CAREPOINT_API_HOST "$CAREPOINT_API_HOST"
require_input CAREPOINT_ADMIN_HOST "$CAREPOINT_ADMIN_HOST"
require_input CAREPOINT_PROVIDER_HOST "$CAREPOINT_PROVIDER_HOST"
require_input CAREPOINT_PATIENT_HOST "$CAREPOINT_PATIENT_HOST"
require_input CAREPOINT_PROVIDER_MOBILE_HOST "$CAREPOINT_PROVIDER_MOBILE_HOST"
require_input ACME_EMAIL "$ACME_EMAIL"

for pair in \
    "CAREPOINT_API_HOST:${CAREPOINT_API_HOST}" \
    "CAREPOINT_ADMIN_HOST:${CAREPOINT_ADMIN_HOST}" \
    "CAREPOINT_PROVIDER_HOST:${CAREPOINT_PROVIDER_HOST}" \
    "CAREPOINT_PATIENT_HOST:${CAREPOINT_PATIENT_HOST}" \
    "CAREPOINT_PROVIDER_MOBILE_HOST:${CAREPOINT_PROVIDER_MOBILE_HOST}"; do
    validate_hostname "${pair%%:*}" "${pair#*:}"
done

[[ "$EXPECTED_RELEASE_SHA" =~ ^[0-9a-fA-F]{40}$ ]] || fail "EXPECTED_RELEASE_SHA must be a full 40-character commit SHA"

if ! command -v openssl >/dev/null 2>&1; then
    fail "openssl is required to generate first-install runtime credentials"
fi
if ! command -v curl >/dev/null 2>&1; then
    fail "curl is required for deployment verification"
fi
if ! command -v git >/dev/null 2>&1; then
    fail "git is required"
fi

echo "============================================"
echo "  CarePoint Controlled v1 Deployment"
echo "  Branch: ${BRANCH}"
echo "  Expected SHA: ${EXPECTED_RELEASE_SHA}"
echo "  API host: ${CAREPOINT_API_HOST}"
echo "============================================"
echo ""

# ---- Step 1: Install Docker if not present -----------------------------------
if ! command -v docker >/dev/null 2>&1; then
    echo "[1/8] Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
else
    echo "[1/8] Docker already installed: $(docker --version)"
fi

docker compose version >/dev/null 2>&1 || fail "docker compose plugin not found"

# ---- Step 2: Clone or update the release branch ------------------------------
echo "[2/8] Setting up repository at ${INSTALL_DIR}..."
if [ -d "${INSTALL_DIR}/.git" ]; then
    cd "${INSTALL_DIR}"
    git fetch --prune origin "$BRANCH"
    git checkout "$BRANCH"
    git reset --hard "origin/${BRANCH}"
else
    rm -rf "${INSTALL_DIR}"
    git clone --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

CURRENT_SHA=$(git rev-parse HEAD)
[ "$CURRENT_SHA" = "$EXPECTED_RELEASE_SHA" ] || fail "branch HEAD ${CURRENT_SHA} does not match EXPECTED_RELEASE_SHA ${EXPECTED_RELEASE_SHA}"
[ -z "$(git status --porcelain)" ] || fail "working tree is not clean after checkout"
echo "Release source pinned to ${CURRENT_SHA}."

mkdir -p "${INSTALL_DIR}/deploy/vps"

# ---- Step 3: Create credentials only on first install ------------------------
if [ -f "$RUNTIME_ENV_FILE" ]; then
    echo "[3/8] Existing runtime credentials found; preserving them."
    chmod 600 "$RUNTIME_ENV_FILE"
else
    echo "[3/8] First install: generating runtime credentials..."
    POSTGRES_PASSWORD=$(openssl rand -hex 32)
    REDIS_PASSWORD=$(openssl rand -hex 32)
    JWT_ACCESS_SECRET=$(openssl rand -hex 32)
    JWT_REFRESH_SECRET=$(openssl rand -hex 32)
    MEDICAL_KEY=$(openssl rand -hex 32)
    PYTHON_SECRET=$(openssl rand -hex 32)

    cat > "$RUNTIME_ENV_FILE" <<EOF
NODE_ENV=production
POSTGRES_DB=${POSTGRES_DB}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public
DIRECT_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_URL=redis://default:${REDIS_PASSWORD}@redis:6379
API_PORT=4000
HEALTH_CHECK_TIMEOUT_MS=2500
JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d
MEDICAL_PROFILE_ENCRYPTION_KEY=${MEDICAL_KEY}
AUTH_CHALLENGE_REDIS_ENABLED=true
AUTH_CHALLENGE_REDIS_PREFIX=carepoint:auth:challenge
ALLOW_LOCALHOST_CORS_WILDCARD=false
ALLOW_AUDIT_FALLBACK_IN_PRODUCTION=false
NEXT_PUBLIC_ALLOW_DEMO_SIGNIN=false
ACME_EMAIL=${ACME_EMAIL}
CAREPOINT_API_HOST=${CAREPOINT_API_HOST}
CAREPOINT_ADMIN_HOST=${CAREPOINT_ADMIN_HOST}
CAREPOINT_PROVIDER_HOST=${CAREPOINT_PROVIDER_HOST}
CAREPOINT_PATIENT_HOST=${CAREPOINT_PATIENT_HOST}
CAREPOINT_PROVIDER_MOBILE_HOST=${CAREPOINT_PROVIDER_MOBILE_HOST}
FRONTEND_ADMIN_URL=https://${CAREPOINT_ADMIN_HOST}
FRONTEND_PROVIDER_URL=https://${CAREPOINT_PROVIDER_HOST}
FRONTEND_PATIENT_URL=https://${CAREPOINT_PATIENT_HOST}
FRONTEND_PROVIDER_MOBILE_URL=https://${CAREPOINT_PROVIDER_MOBILE_HOST}
FRONTEND_ALLOWED_ORIGINS=https://${CAREPOINT_ADMIN_HOST},https://${CAREPOINT_PROVIDER_HOST},https://${CAREPOINT_PATIENT_HOST},https://${CAREPOINT_PROVIDER_MOBILE_HOST}
NEXT_PUBLIC_API_BASE_URL=https://${CAREPOINT_API_HOST}
PATIENT_API_BASE_URL=https://${CAREPOINT_API_HOST}
PROVIDER_MOBILE_API_BASE_URL=https://${CAREPOINT_API_HOST}
RESEND_API_KEY=
EMAIL_FROM=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
TELEHEALTH_VENDOR=daily
DAILY_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
PRIVILEGED_ALLOWED_EMAIL_DOMAINS=
SSO_ENABLED=false
SSO_PROVIDER_NAME=
SSO_AUTHORIZE_URL=
SSO_CLIENT_ID=
SSO_CALLBACK_URL=
SSO_SCOPE=openid profile email
PYTHON_SERVICES_BASE_URL=http://python-worker-api:8010
PYTHON_SERVICES_SHARED_SECRET=${PYTHON_SECRET}
PYTHON_SERVICES_TIMEOUT_MS=2500
PYTHON_SERVICES_SIGN_REQUESTS=true
PYTHON_WORKER_API_PORT=8010
PYTHON_WORKER_QUEUE_ENABLED=true
PYTHON_WORKER_JOB_STATUS_REDIS_ENABLED=true
PYTHON_WORKER_JOB_STATUS_TTL_SECONDS=86400
PYTHON_WORKER_REQUIRE_SHARED_SECRET=true
PYTHON_WORKER_REQUIRE_SIGNATURE=true
PYTHON_WORKER_ALLOW_LEGACY_SECRET_HEADER=false
PYTHON_WORKER_SIGNATURE_TOLERANCE_SECONDS=300
PYTHON_WORKER_METRICS_ENABLED=true
PYTHON_WORKER_OTEL_ENABLED=false
PYTHON_WORKER_ARTIFACT_STORAGE_DIR=/artifacts
PYTHON_WORKER_ROLLOUT_STATE_PATH=/state/rollout-state.json
HYBRID_PYTHON_ENABLED=false
HYBRID_PYTHON_CANARY_PERCENT=0
HYBRID_PYTHON_SHADOW_MODE=true
HYBRID_PYTHON_USE_CONTROL_PLANE_ASSIGNMENT=false
HYBRID_PYTHON_CONTROL_PLANE_FAIL_OPEN=false
HYBRID_PYTHON_DEFAULT_ROUTE=/api/hybrid-python/jobs
CELERY_BROKER_URL=redis://default:${REDIS_PASSWORD}@redis:6379
CELERY_RESULT_BACKEND=redis://default:${REDIS_PASSWORD}@redis:6379
EOF
    chmod 600 "$RUNTIME_ENV_FILE"
    echo "First-install credentials created. Secret values were not printed."
fi

# ---- Step 4: Reconcile non-secret release configuration ----------------------
echo "[4/8] Enforcing release-safe runtime configuration..."
upsert_runtime_value NODE_ENV production
upsert_runtime_value ALLOW_LOCALHOST_CORS_WILDCARD false
upsert_runtime_value ALLOW_AUDIT_FALLBACK_IN_PRODUCTION false
upsert_runtime_value NEXT_PUBLIC_ALLOW_DEMO_SIGNIN false
upsert_runtime_value ACME_EMAIL "$ACME_EMAIL"
upsert_runtime_value CAREPOINT_API_HOST "$CAREPOINT_API_HOST"
upsert_runtime_value CAREPOINT_ADMIN_HOST "$CAREPOINT_ADMIN_HOST"
upsert_runtime_value CAREPOINT_PROVIDER_HOST "$CAREPOINT_PROVIDER_HOST"
upsert_runtime_value CAREPOINT_PATIENT_HOST "$CAREPOINT_PATIENT_HOST"
upsert_runtime_value CAREPOINT_PROVIDER_MOBILE_HOST "$CAREPOINT_PROVIDER_MOBILE_HOST"
upsert_runtime_value FRONTEND_ADMIN_URL "https://${CAREPOINT_ADMIN_HOST}"
upsert_runtime_value FRONTEND_PROVIDER_URL "https://${CAREPOINT_PROVIDER_HOST}"
upsert_runtime_value FRONTEND_PATIENT_URL "https://${CAREPOINT_PATIENT_HOST}"
upsert_runtime_value FRONTEND_PROVIDER_MOBILE_URL "https://${CAREPOINT_PROVIDER_MOBILE_HOST}"
upsert_runtime_value FRONTEND_ALLOWED_ORIGINS "https://${CAREPOINT_ADMIN_HOST},https://${CAREPOINT_PROVIDER_HOST},https://${CAREPOINT_PATIENT_HOST},https://${CAREPOINT_PROVIDER_MOBILE_HOST}"
upsert_runtime_value NEXT_PUBLIC_API_BASE_URL "https://${CAREPOINT_API_HOST}"
upsert_runtime_value PATIENT_API_BASE_URL "https://${CAREPOINT_API_HOST}"
upsert_runtime_value PROVIDER_MOBILE_API_BASE_URL "https://${CAREPOINT_API_HOST}"
chmod 600 "$RUNTIME_ENV_FILE"

# Redis background persistence is unreliable when memory overcommit is disabled.
echo 'vm.overcommit_memory=1' > /etc/sysctl.d/99-carepoint.conf
sysctl -w vm.overcommit_memory=1 >/dev/null

# Fail before any network/firewall change if source, DNS, secrets or compose are unsafe.
INSTALL_DIR="$INSTALL_DIR" \
CAREPOINT_BRANCH="$BRANCH" \
CAREPOINT_RUNTIME_ENV_FILE="$RUNTIME_ENV_FILE" \
EXPECTED_RELEASE_SHA="$EXPECTED_RELEASE_SHA" \
bash "${INSTALL_DIR}/deploy/vps/preflight.sh"

# ---- Step 5: Restrict firewall to SSH + TLS edge -----------------------------
echo "[5/8] Configuring firewall for 22/80/443 only..."
if command -v ufw >/dev/null 2>&1; then
    ufw allow 22/tcp >/dev/null 2>&1 || true
    ufw allow 80/tcp >/dev/null 2>&1 || true
    ufw allow 443/tcp >/dev/null 2>&1 || true
    # Remove legacy direct-service rules if an earlier deployment created them.
    for port in 3001 3002 4000 8080 8081; do
        ufw --force delete allow "${port}/tcp" >/dev/null 2>&1 || true
    done
    ufw --force enable >/dev/null 2>&1 || true
    echo "Firewall restricted to SSH and the TLS edge."
else
    echo "WARNING: ufw not installed. Enforce 22/80/443-only ingress at the provider firewall/security group." >&2
fi

# ---- Step 6: Build the exact pinned source -----------------------------------
echo "[6/8] Building release containers..."
cd "$INSTALL_DIR"
docker compose -f "$COMPOSE_FILE" --env-file "$RUNTIME_ENV_FILE" build

# ---- Step 7: Start services and wait for API health --------------------------
echo "[7/8] Starting services..."
docker compose -f "$COMPOSE_FILE" --env-file "$RUNTIME_ENV_FILE" up -d

api_container=$(docker compose -f "$COMPOSE_FILE" --env-file "$RUNTIME_ENV_FILE" ps -q api)
[ -n "$api_container" ] || fail "API container was not created"

api_healthy=false
for _ in $(seq 1 36); do
    health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$api_container" 2>/dev/null || true)
    if [ "$health" = "healthy" ]; then
        api_healthy=true
        break
    fi
    if [ "$health" = "exited" ] || [ "$health" = "dead" ]; then
        break
    fi
    sleep 5
done

if [ "$api_healthy" != true ]; then
    docker compose -f "$COMPOSE_FILE" --env-file "$RUNTIME_ENV_FILE" ps >&2 || true
    docker compose -f "$COMPOSE_FILE" --env-file "$RUNTIME_ENV_FILE" logs --tail=100 api >&2 || true
    fail "API did not become healthy"
fi

# ---- Step 8: Verify public HTTPS ---------------------------------------------
echo "[8/8] Verifying public HTTPS endpoints..."
verify_url() {
    local label="$1"
    local url="$2"
    if curl --fail --silent --show-error --location --retry 12 --retry-all-errors --retry-delay 5 --max-time 15 "$url" >/dev/null; then
        echo "  [OK] ${label}: ${url}"
    else
        fail "public verification failed for ${label}: ${url}"
    fi
}

verify_url "API live" "https://${CAREPOINT_API_HOST}/livez"
verify_url "API ready" "https://${CAREPOINT_API_HOST}/readyz"
verify_url "Admin" "https://${CAREPOINT_ADMIN_HOST}/"
verify_url "Provider" "https://${CAREPOINT_PROVIDER_HOST}/"
verify_url "Patient" "https://${CAREPOINT_PATIENT_HOST}/"
verify_url "Provider Mobile Web" "https://${CAREPOINT_PROVIDER_MOBILE_HOST}/"

echo ""
echo "Deployment verified for SHA ${CURRENT_SHA}."
echo "Next release gates: backup/restore proof, observability, integrations, UAT and rollback rehearsal."
