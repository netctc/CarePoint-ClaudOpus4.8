# Option B - Implementation V3: signed bridge, metrics, artifacts and operator introspection

## Objective

Continue the progressive Python adoption path without replacing the Node/Express API. V3 hardens the Node -> Python bridge and turns the Python worker into a more observable operational component for low-risk, contract-owned workloads.

This still preserves the Option B boundary: Node owns authentication, RBAC, object authorization, Prisma writes and user-facing compatibility. Python owns worker-style preparation, validation, metrics and sanitized artifacts.

## Delivered changes

### Python worker

- Bumped worker package version to `0.3.0`.
- Added canonical HMAC-SHA256 verification for Node -> Python bridge requests:
  - `x-carepoint-python-timestamp`
  - `x-carepoint-python-signature`
  - optional legacy `x-carepoint-python-secret` retained for local compatibility.
- Added runtime flags:
  - `PYTHON_WORKER_REQUIRE_SIGNATURE`
  - `PYTHON_WORKER_SIGNATURE_TOLERANCE_SECONDS`
  - `PYTHON_WORKER_ARTIFACT_STORAGE_DIR`
- Added an optional Redis-backed job status store:
  - `PYTHON_WORKER_JOB_STATUS_REDIS_ENABLED`
  - `PYTHON_WORKER_JOB_STATUS_TTL_SECONDS`
  - `PYTHON_WORKER_JOB_STATUS_REDIS_PREFIX`
- Added job attempts and cancellation reason to job records.
- Celery task execution now marks jobs as `running`, `succeeded`, or `failed` in the shared job store.
- Added sanitized local artifact registry for:
  - audit export preparation plans and Node-prefiltered audit rows
  - bulk account validation reports
- Added status aliases:
  - `GET /api/v1/jobs/{lookup}`
  - `GET /api/v1/jobs/status/{lookup}`
- Added operational endpoints:
  - `GET /api/v1/jobs/summary`
  - `GET /api/v1/jobs/metrics`
  - `GET /api/v1/shadow/jobs`
  - `GET /api/v1/metrics/snapshot`
  - `GET /metrics`
- Manifest now reports security, metrics and storage information, including `statusBackend` and artifact root.

### Node bridge

- Node signs Python bridge requests with HMAC-SHA256 when `PYTHON_SERVICES_SHARED_SECRET` is configured.
- Shadow traffic remains fail-open by default through `HYBRID_PYTHON_SHADOW_FAIL_OPEN=true`.
- Added bridge functions for:
  - job summary
  - job metrics
  - shadow records
  - cancellation
- Added operator routes:
  - `GET /api/hybrid-python/jobs/metrics`
  - `GET /api/hybrid-python/shadow/jobs`
  - `POST /api/hybrid-python/jobs/:idempotencyKey/cancel`
- Domain prepare routes continue to route by contract and canary:
  - `POST /api/hybrid-python/admin/audit-export/prepare`
  - `POST /api/hybrid-python/admin/accounts/bulk-validate/prepare`
  - `POST /api/hybrid-python/analytics/snapshot/prepare`
  - `POST /api/hybrid-python/notifications/dispatch/prepare`
  - `POST /api/hybrid-python/ai/triage-preview/prepare`

### Contracts

- Added artifact fields for sanitized Python outputs:
  - `path`
  - `redactionApplied`
  - `piiClass`
- Added job attempts and cancellation metadata to job records.
- Added:
  - `hybridPythonJobMetricsSchema`
  - `hybridPythonShadowMetricsSchema`
  - `hybridPythonJobCancelSchema`
- Extended bulk validation prepare schema with `csvText` and `allowedEmailDomains`.

## Rollout flags

```bash
HYBRID_PYTHON_ENABLED=false
HYBRID_PYTHON_CANARY_PERCENT=0
HYBRID_PYTHON_SHADOW_MODE=true
HYBRID_PYTHON_SHADOW_FAIL_OPEN=true
PYTHON_SERVICES_BASE_URL=http://python-worker-api:8010
PYTHON_SERVICES_SHARED_SECRET=<long-random-secret>
PYTHON_WORKER_REQUIRE_SHARED_SECRET=true
PYTHON_WORKER_REQUIRE_SIGNATURE=true
PYTHON_WORKER_SIGNATURE_TOLERANCE_SECONDS=300
PYTHON_WORKER_ARTIFACT_STORAGE_DIR=/artifacts
PYTHON_WORKER_QUEUE_ENABLED=false
PYTHON_WORKER_JOB_STATUS_REDIS_ENABLED=false
```

For Celery staging:

```bash
PYTHON_WORKER_QUEUE_ENABLED=true
PYTHON_WORKER_JOB_STATUS_REDIS_ENABLED=true
REDIS_URL=redis://redis:6379
CELERY_BROKER_URL=redis://redis:6379
CELERY_RESULT_BACKEND=redis://redis:6379
```

## Acceptance checks

```bash
npm run check:secrets --silent
npm run verify:workspace --silent
npm run verify:python-worker --silent
cd services/python-worker && python3 -m pytest -q
```

Observed in this package:

```text
S0 secret/artifact check passed
S0 workspace verification passed
Option B Python worker v3 verification passed
11 passed
```

## Functional boundaries still retained by Node

- Authentication and RBAC.
- Organization/object authorization.
- Prisma writes and schema ownership.
- Final artifact delivery/signed URL generation for production exports.
- Audit-event persistence.
- User-facing response compatibility.

## Next candidate for V4

- Add Node-side shadow comparison logs for selected endpoints.
- Add canary decision audit events or a structured log sink.
- Add a read-only DB repository in Python for one low-risk read model.
- Add OpenTelemetry span attributes for job type, idempotency key hash, status and artifact count.
