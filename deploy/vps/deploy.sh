#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# CarePoint VPS Deployment Script
# Deploys the complete CarePoint platform on a single VPS using Docker Compose.
# Run this script ON your VPS as root (or with sudo).
#
# Usage:
#   VPS_IP=<public-ip-or-host> ./deploy.sh
# Optional:
#   CAREPOINT_BRANCH=release/v1-go-live VPS_IP=<public-ip-or-host> ./deploy.sh
#
# What it does:
#   1. Installs Docker + Docker Compose if not present
#   2. Clones (or pulls) the repository
#   3. Generates production secrets
#   4. Creates the runtime environment file on the VPS only
#   5. Builds and starts all services
#   6. Runs database migrations through the API production start command
#   7. Prints access URLs
# =============================================================================

# ---- Configuration -----------------------------------------------------------
VPS_IP="${VPS_IP:-}"
REPO_URL="${REPO_URL:-https://github.com/netctc/CarePoint-ClaudOpus4.8.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/carepoint}"
BRANCH="${CAREPOINT_BRANCH:-release/v1-go-live}"

if [ -z "${VPS_IP}" ]; then
    echo "ERROR: VPS_IP is required. Example: VPS_IP=203.0.113.10 ./deploy.sh"
    exit 1
fi

# Ports exposed to the internet
API_PORT="${API_PORT:-4000}"
ADMIN_PORT="${ADMIN_PORT:-3001}"
PROVIDER_PORT="${PROVIDER_PORT:-3002}"
PATIENT_PORT="${PATIENT_PORT:-8080}"
PROVIDER_MOBILE_PORT="${PROVIDER_MOBILE_PORT:-8081}"

# Database identity (password is generated at runtime)
POSTGRES_DB="${POSTGRES_DB:-care_center}"
POSTGRES_USER="${POSTGRES_USER:-carecenter}"

# =============================================================================

echo "============================================"
echo "  CarePoint VPS Deployment"
echo "  Target: ${VPS_IP}"
echo "  Branch: ${BRANCH}"
echo "============================================"
echo ""

# ---- Step 1: Install Docker if not present -----------------------------------
if ! command -v docker &>/dev/null; then
    echo "[1/7] Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "Docker installed."
else
    echo "[1/7] Docker already installed: $(docker --version)"
fi

if ! docker compose version &>/dev/null; then
    echo "ERROR: docker compose plugin not found. Install Docker Engine 24+ or docker-compose-plugin."
    exit 1
fi

# ---- Step 2: Clone or update repository --------------------------------------
echo "[2/7] Setting up repository at ${INSTALL_DIR}..."
if [ -d "${INSTALL_DIR}/.git" ]; then
    cd "${INSTALL_DIR}"
    git fetch origin
    git checkout "${BRANCH}"
    git pull --ff-only origin "${BRANCH}"
    echo "Repository updated."
else
    rm -rf "${INSTALL_DIR}"
    git clone --depth 1 --branch "${BRANCH}" "${REPO_URL}" "${INSTALL_DIR}"
    cd "${INSTALL_DIR}"
    echo "Repository cloned."
fi

# ---- Step 3: Generate secrets ------------------------------------------------
echo "[3/7] Generating production secrets..."
POSTGRES_PASSWORD=$(openssl rand -hex 32)
REDIS_PASSWORD=$(openssl rand -hex 32)
JWT_ACCESS_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
MEDICAL_KEY=$(openssl rand -hex 32)
PYTHON_SECRET=$(openssl rand -hex 32)

echo "Secrets generated."

# ---- Step 4: Create runtime environment file ---------------------------------
echo "[4/7] Creating runtime environment file..."
mkdir -p "${INSTALL_DIR}/deploy/vps"

cat > "${INSTALL_DIR}/deploy/vps/.env" <<EOF
# === CarePoint Production Environment ===
# Generated on $(date -u +"%Y-%m-%d %H:%M:%S UTC")

NODE_ENV=production

# --- Database ---
POSTGRES_DB=${POSTGRES_DB}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public
DIRECT_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public

# --- Redis ---
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_URL=redis://default:${REDIS_PASSWORD}@redis:6379

# --- API ---
API_PORT=${API_PORT}
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

# --- CORS / Frontend URLs ---
FRONTEND_ADMIN_URL=http://${VPS_IP}:${ADMIN_PORT}
FRONTEND_PROVIDER_URL=http://${VPS_IP}:${PROVIDER_PORT}
FRONTEND_PATIENT_URL=http://${VPS_IP}:${PATIENT_PORT}
FRONTEND_PROVIDER_MOBILE_URL=http://${VPS_IP}:${PROVIDER_MOBILE_PORT}
FRONTEND_ALLOWED_ORIGINS=http://${VPS_IP}:${ADMIN_PORT},http://${VPS_IP}:${PROVIDER_PORT},http://${VPS_IP}:${PATIENT_PORT},http://${VPS_IP}:${PROVIDER_MOBILE_PORT}

# --- Build-time values ---
NEXT_PUBLIC_API_BASE_URL=http://${VPS_IP}:${API_PORT}
NEXT_PUBLIC_ALLOW_DEMO_SIGNIN=false
PATIENT_API_BASE_URL=http://${VPS_IP}:${API_PORT}
PROVIDER_MOBILE_API_BASE_URL=http://${VPS_IP}:${API_PORT}

# --- Email (OTP) ---
RESEND_API_KEY=
EMAIL_FROM=CarePoint <onboarding@resend.dev>
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# --- Optional integrations ---
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

# --- Python Worker ---
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

chmod 600 "${INSTALL_DIR}/deploy/vps/.env"
echo "Runtime environment file created with mode 600."

# ---- Step 5: Open firewall ports ---------------------------------------------
echo "[5/7] Configuring firewall..."
if command -v ufw &>/dev/null; then
    ufw allow 22/tcp   >/dev/null 2>&1 || true
    ufw allow 80/tcp   >/dev/null 2>&1 || true
    ufw allow 443/tcp  >/dev/null 2>&1 || true
    ufw allow ${API_PORT}/tcp >/dev/null 2>&1 || true
    ufw allow ${ADMIN_PORT}/tcp >/dev/null 2>&1 || true
    ufw allow ${PROVIDER_PORT}/tcp >/dev/null 2>&1 || true
    ufw allow ${PATIENT_PORT}/tcp >/dev/null 2>&1 || true
    ufw allow ${PROVIDER_MOBILE_PORT}/tcp >/dev/null 2>&1 || true
    ufw --force enable >/dev/null 2>&1 || true
    echo "Firewall configured."
else
    echo "ufw not found, skipping firewall config. Make sure required ports are open."
fi

# ---- Step 6: Build and start -------------------------------------------------
echo "[6/7] Building and starting all services..."
cd "${INSTALL_DIR}"
docker compose -f deploy/vps/docker-compose.yml --env-file deploy/vps/.env build
docker compose -f deploy/vps/docker-compose.yml --env-file deploy/vps/.env up -d

echo "Waiting for services to be healthy..."
sleep 10

# ---- Step 7: Verify ----------------------------------------------------------
echo "[7/7] Verifying deployment..."
echo ""

if curl -sf "http://127.0.0.1:${API_PORT}/livez" >/dev/null 2>&1; then
    echo "  [OK] API is healthy"
else
    echo "  [!!] API not responding yet. Check API logs before continuing."
fi

if curl -sf "http://127.0.0.1:${API_PORT}/readyz" >/dev/null 2>&1; then
    echo "  [OK] API is ready"
else
    echo "  [!!] API readiness check is not green. Do not promote this deployment."
fi

echo ""
echo "============================================"
echo "  DEPLOYMENT COMPLETE"
echo "============================================"
echo ""
echo "  Verify services at the configured host and ports."
echo "  Before production promotion, place public services behind HTTPS/TLS"
echo "  and restrict direct container/application ports at the network edge."
echo ""
echo "  Useful commands:"
echo "    cd ${INSTALL_DIR}"
echo "    docker compose -f deploy/vps/docker-compose.yml --env-file deploy/vps/.env logs -f api"
echo "    docker compose -f deploy/vps/docker-compose.yml --env-file deploy/vps/.env ps"
echo "    docker compose -f deploy/vps/docker-compose.yml --env-file deploy/vps/.env restart api"
echo ""
echo "  Runtime credentials are stored only on the VPS in deploy/vps/.env (mode 600)."
echo "  Never commit or copy that file into GitHub issues or documentation."
