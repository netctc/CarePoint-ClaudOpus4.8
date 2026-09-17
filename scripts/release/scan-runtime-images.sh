#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

TRIVY_BIN="${TRIVY_BIN:-trivy}"
REPORT_DIR="${TRIVY_REPORT_DIR:-${RUNNER_TEMP:-/tmp}/carepoint-trivy}"
SUMMARY_FILE="${GITHUB_STEP_SUMMARY:-$REPORT_DIR/summary.md}"
IMAGE_SUFFIX="${GITHUB_SHA:-local}"

mkdir -p "$REPORT_DIR"

if ! command -v "$TRIVY_BIN" >/dev/null 2>&1; then
  echo "Trivy executable not found: $TRIVY_BIN" >&2
  exit 2
fi
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for the release image scan." >&2
  exit 2
fi

compose_image() {
  local service="$1"
  awk -v service="$service" '
    $0 == "  " service ":" { found = 1; next }
    found && $1 == "image:" { print $2; exit }
    found && /^  [A-Za-z0-9_-]+:/ { exit }
  ' deploy/vps/docker-compose.yml
}

build_image() {
  local tag="$1"
  local dockerfile="$2"
  shift 2
  echo "Building $tag from $dockerfile"
  docker build --file "$dockerfile" --tag "$tag" "$@" .
}

scan_image() {
  local label="$1"
  local image="$2"
  local report="$REPORT_DIR/${label}.json"
  local image_id
  image_id="$(docker image inspect --format '{{.Id}}' "$image")"

  echo "Scanning $label ($image)"
  "$TRIVY_BIN" image \
    --quiet \
    --scanners vuln \
    --severity HIGH,CRITICAL \
    --format json \
    --output "$report" \
    "$image"

  python3 - "$report" "$label" "$image" "$image_id" <<'PY' >> "$SUMMARY_FILE"
import json
import sys

report_path, label, image, image_id = sys.argv[1:]
with open(report_path, encoding="utf-8") as handle:
    payload = json.load(handle)

counts = {"HIGH": 0, "CRITICAL": 0}
fixable = 0
unfixed = 0
for result in payload.get("Results") or []:
    for vuln in result.get("Vulnerabilities") or []:
        severity = str(vuln.get("Severity") or "").upper()
        if severity not in counts:
            continue
        counts[severity] += 1
        if str(vuln.get("FixedVersion") or "").strip():
            fixable += 1
        else:
            unfixed += 1

total = counts["HIGH"] + counts["CRITICAL"]
print(f"| {label} | `{image}` | `{image_id}` | {counts['HIGH']} | {counts['CRITICAL']} | {fixable} | {unfixed} |")
if total:
    sys.exit(10)
PY
}

API_IMAGE="carepoint-scan-api:${IMAGE_SUFFIX}"
ADMIN_IMAGE="carepoint-scan-admin:${IMAGE_SUFFIX}"
PROVIDER_IMAGE="carepoint-scan-provider:${IMAGE_SUFFIX}"
PATIENT_IMAGE="carepoint-scan-patient:${IMAGE_SUFFIX}"
PROVIDER_MOBILE_IMAGE="carepoint-scan-provider-mobile:${IMAGE_SUFFIX}"
PYTHON_WORKER_IMAGE="carepoint-scan-python-worker:${IMAGE_SUFFIX}"

# Build exactly from the release repository SHA. Build arguments are non-secret
# placeholders because vulnerability scanning does not require live credentials.
build_image "$API_IMAGE" services/api/Dockerfile \
  --build-arg DATABASE_URL=postgresql://scan:scan@postgres:5432/carepoint \
  --build-arg DIRECT_URL=postgresql://scan:scan@postgres:5432/carepoint \
  --build-arg REDIS_URL=redis://redis:6379
build_image "$ADMIN_IMAGE" apps/admin/Dockerfile \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.invalid.example \
  --build-arg NEXT_PUBLIC_ALLOW_DEMO_SIGNIN=false
build_image "$PROVIDER_IMAGE" apps/provider/Dockerfile \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.invalid.example
build_image "$PATIENT_IMAGE" apps/mobile/Dockerfile \
  --build-arg API_BASE_URL=https://api.invalid.example
build_image "$PROVIDER_MOBILE_IMAGE" apps/provider_mobile/Dockerfile \
  --build-arg API_BASE_URL=https://api.invalid.example
build_image "$PYTHON_WORKER_IMAGE" services/python-worker/Dockerfile

POSTGRES_IMAGE="$(compose_image postgres)"
REDIS_IMAGE="$(compose_image redis)"
CADDY_IMAGE="$(compose_image edge)"

for required in POSTGRES_IMAGE REDIS_IMAGE CADDY_IMAGE; do
  value="${!required:-}"
  if [[ -z "$value" || "$value" != *@sha256:* ]]; then
    echo "Could not resolve digest-pinned compose image for $required" >&2
    exit 2
  fi
done

docker pull "$POSTGRES_IMAGE"
docker pull "$REDIS_IMAGE"
docker pull "$CADDY_IMAGE"

{
  echo "## CarePoint runtime image vulnerability scan"
  echo
  echo "- Timestamp (UTC): $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "- Candidate SHA: ${GITHUB_SHA:-local}"
  echo "- Scanner: $($TRIVY_BIN --version | head -n 1)"
  echo "- Policy: any HIGH or CRITICAL vulnerability blocks this gate until remediated or explicitly accepted in the Go/No-Go security exception record."
  echo
  echo "| Surface | Image/ref | Image ID | HIGH | CRITICAL | Fixable | Unfixed |"
  echo "| --- | --- | --- | ---: | ---: | ---: | ---: |"
} >> "$SUMMARY_FILE"

failed=0
for entry in \
  "api|$API_IMAGE" \
  "admin|$ADMIN_IMAGE" \
  "provider|$PROVIDER_IMAGE" \
  "patient-web|$PATIENT_IMAGE" \
  "provider-mobile-web|$PROVIDER_MOBILE_IMAGE" \
  "python-worker|$PYTHON_WORKER_IMAGE" \
  "postgres|$POSTGRES_IMAGE" \
  "redis|$REDIS_IMAGE" \
  "caddy|$CADDY_IMAGE"; do
  label="${entry%%|*}"
  image="${entry#*|}"
  if ! scan_image "$label" "$image"; then
    failed=1
  fi
done

if [[ "$failed" -ne 0 ]]; then
  echo >&2
  echo "Release image security gate failed: HIGH/CRITICAL findings require remediation or an explicit approved exception." >&2
  exit 1
fi

echo "Release image security gate passed: no HIGH/CRITICAL findings across required runtime surfaces."
