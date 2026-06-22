# CarePoint Option B implementation summary

This package implements the selected Option B path: hybrid Python progressive adoption.

## v1 foundation

- Added `services/python-worker` with a FastAPI service, Celery-ready worker, health/readiness endpoints, manifest endpoint, job envelope validation, shadow traffic recording, and dry-run enqueue support.
- Added Node API bridge under `/api/hybrid-python` with status, routing preview, and job enqueue routes protected by existing auth/RBAC middleware.
- Added shared Zod contracts for the Python job envelope and accepted-job response in `packages/contracts`.
- Added Docker Compose and Dokploy service definitions for `python-worker-api` and `python-worker-celery`.
- Added environment flags for safe rollout: `HYBRID_PYTHON_ENABLED`, `HYBRID_PYTHON_CANARY_PERCENT`, `HYBRID_PYTHON_SHADOW_MODE`, `PYTHON_SERVICES_BASE_URL`, and `PYTHON_SERVICES_SHARED_SECRET`.
- Updated Node runtime targets from Node 20 to Node 22 in CI and Node Dockerfiles.
- Removed repository hygiene blockers listed in the architecture report: copied files, `.old` files, local zip files, `.data`, `.runtime`, and local JSON stores.

## v2 continuation

- Added real Python dry-run processors for audit exports, bulk account validation, notification dispatch planning, analytics snapshots, and non-diagnostic AI triage previews.
- Added process-local idempotent job status registry and `GET /api/v1/jobs/{idempotencyKey}`.
- Updated Celery so queued jobs use the same processor layer.
- Added Node proxy `GET /api/hybrid-python/jobs/:idempotencyKey`.
- Added first domain-specific Node handoff: `POST /api/hybrid-python/admin/audit-export/prepare`.
- Added contract schemas for job status, result, record, and audit export preparation.

## v3 hardening

- Added HMAC-SHA256 signing and verification for Node-to-Python bridge requests with timestamp replay-window checks.
- Added optional Redis-backed job status sharing so FastAPI and Celery workers can report the same lifecycle state.
- Added artifact registry and metadata for audit exports, bulk validation reports, and analytics snapshots.
- Added job policy/data-minimization guardrails that reject unsafe payload shapes before execution.
- Added Prometheus-compatible `/metrics` plus JSON job/shadow metrics endpoints.
- Added shadow traffic inspection routes and Node bridge proxy routes for job metrics and shadow records.
- Added domain-specific prepare routes for bulk account validation, analytics snapshots, notification dispatch planning, and AI triage preview.
- Updated contracts and Docker Compose environment wiring for signed bridge calls, artifact storage, metrics, and Redis status.

## Default rollout posture

The Python path is deployed but inactive by default:

```bash
HYBRID_PYTHON_ENABLED=false
HYBRID_PYTHON_CANARY_PERCENT=0
HYBRID_PYTHON_SHADOW_MODE=true
```

Use `forcePython=1` only for controlled smoke tests. Increase canary percentage only after staging health, metrics, artifact, and rollback checks pass.

## Validation performed for v3

Run these checks from the repository root:

```bash
npm run check:secrets --silent
npm run verify:workspace --silent
npm run verify:python-worker --silent
cd services/python-worker && python3 -m pytest -q
```

A full Node dependency install/build may still require a normal development or CI environment with cached dependencies:

```bash
npm ci
npm run build:contracts
npm run build:api
npm run build:admin
npm run build:provider
```

## V5 addition

V5 adds contract-first rollout governance and an operational canary rollout controller:

- Versioned contract manifest, sanitized test vectors and contract validation without enqueue side effects.
- Rollout readiness report based on canary gate, contract cap and signed bridge readiness.
- Persisted rollout state, deterministic canary assignment and rollback/pause/resume controls.
- Matching Node bridge routes and TypeScript contracts for rollout planning and assignment.

Validated with `check:secrets`, workspace verification, `verify:python-worker` and Python contract tests.


## V6 additions

- Node can optionally use the Python canary control plane for assignment.
- Canary rollout actions are route-scoped.
- Python exposes release checklist and rollout evidence bundle endpoints.
- Node bridge exposes the same evidence through authenticated admin routes.
- Validation includes route-specific rollout, checklist and evidence tests.
