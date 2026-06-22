# Option B implementation v2: audit export dry-run handoff

## Purpose

v2 continues the hybrid Python path without rewriting the Node API. It implements the first real Python processing slice while keeping Node as the system of record.

The selected slice is audit export preparation because the architecture report recommended moving exports and heavy jobs out of the request path before deeper framework changes.

## What changed

### Python worker

- Added domain job processors in `services/python-worker/carepoint_python_worker/jobs/`.
- Added process-local idempotent job registry for dry-run and contract validation.
- Added `GET /api/v1/jobs/{idempotencyKey}`.
- Added concrete processors for:
  - `admin.audit_export`
  - `admin.accounts_bulk_validate`
  - `notifications.dispatch`
  - `analytics.snapshot`
  - `ai.triage_preview`
- Updated Celery task `carepoint.jobs.handle` so queue execution uses the same processor layer as inline dry-run.
- Non-dry-run jobs now require `PYTHON_WORKER_QUEUE_ENABLED=true`.

### Node bridge

- Added `GET /api/hybrid-python/jobs/:idempotencyKey` to retrieve Python job status through Node auth/RBAC.
- Added `POST /api/hybrid-python/admin/audit-export/prepare` as the first domain-specific handoff.
- The audit export handoff creates a deterministic idempotency key from actor, organization, filters and format.
- Node still owns auth, RBAC, organization scope, final delivery, signed URLs and audit persistence.

### Contracts

- Added job status, job record, job result and audit export preparation schemas in `packages/contracts`.

## New local smoke flow

Start Python worker API:

```bash
npm run dev:python-worker
```

Force a dry-run audit export preparation through the Node bridge:

```bash
curl -X POST 'http://localhost:4000/api/hybrid-python/admin/audit-export/prepare?forcePython=1' \
  -H 'authorization: Bearer <token>' \
  -H 'content-type: application/json' \
  -d '{
    "dryRun": true,
    "format": "csv",
    "maxRows": 1000,
    "filters": {"from":"2026-01-01","to":"2026-01-31","resource":"Appointment"}
  }'
```

Then check status using the returned `idempotencyKey`:

```bash
curl 'http://localhost:4000/api/hybrid-python/jobs/<idempotencyKey>' \
  -H 'authorization: Bearer <token>'
```

## Production guardrails

- Keep live jobs disabled until a durable job-state ADR is approved.
- Keep canary at 0 unless staging shadow and forced smoke tests pass.
- Do not send raw PHI to Python unless the domain ADR defines a minimization policy.
- Treat AI triage as non-diagnostic preview only; it must require clinical review.

## Rollback

Disable Python routing and keep Node as the retained path:

```bash
HYBRID_PYTHON_ENABLED=false
HYBRID_PYTHON_CANARY_PERCENT=0
HYBRID_PYTHON_SHADOW_MODE=false
```

No database ownership changed in v2.
