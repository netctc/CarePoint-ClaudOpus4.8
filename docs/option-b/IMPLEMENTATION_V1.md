# Option B implementation v1: hybrid Python progressive

## What changed

This zip starts the Option B implementation by adding the Python worker foundation while keeping Node as the main API runtime.

### Added

- FastAPI worker API at `services/python-worker`.
- Celery task placeholder for future async jobs.
- Node bridge at `/api/hybrid-python`.
- Shared TypeScript/Zod contracts for Python job envelopes.
- Docker Compose services for `python-worker-api` and `python-worker-celery`.
- Dokploy compose wiring and environment variables.
- CI-ready Python verification script.

### Cleaned

The repository hygiene blockers called out by the architecture report were removed from this implementation package: copied files, `.old` files, local `.zip` artifacts, `.data`, `.runtime`, and local JSON stores.

## Local runbook

1. Start infra and the Python worker API:

```bash
docker compose up postgres redis python-worker-api
```

2. Run the Node API locally with Python bridge disabled:

```bash
HYBRID_PYTHON_ENABLED=false npm run dev:api
```

3. Enable shadow mode for staging validation:

```bash
HYBRID_PYTHON_ENABLED=true HYBRID_PYTHON_CANARY_PERCENT=0 HYBRID_PYTHON_SHADOW_MODE=true npm run dev:api
```

4. Force a single job through Python for smoke testing:

```bash
curl -X POST http://localhost:4000/api/hybrid-python/jobs?forcePython=1 \
  -H "authorization: Bearer <token>" \
  -H "content-type: application/json" \
  -d '{"jobType":"admin.audit_export","idempotencyKey":"audit-export-smoke-0001","dryRun":true,"payload":{"filters":{"from":"2026-01-01","to":"2026-01-31"}}}'
```

## Canary rollout

| Stage | HYBRID_PYTHON_ENABLED | HYBRID_PYTHON_CANARY_PERCENT | HYBRID_PYTHON_SHADOW_MODE |
| --- | --- | --- | --- |
| Local default | false | 0 | true |
| Staging shadow | true | 0 | true |
| Internal canary | true | 1 | true |
| Controlled pilot | true | 5 | true |
| Domain migration candidate | true | 10-25 | true |

## Rollback

Disable routing without redeploying code:

```bash
HYBRID_PYTHON_ENABLED=false
HYBRID_PYTHON_CANARY_PERCENT=0
HYBRID_PYTHON_SHADOW_MODE=false
```

The Python containers can remain deployed while traffic is disabled.

## Next implementation slice

Recommended next slice: move audit export preparation to Python as a real idempotent worker job while Node remains owner of auth, authorization, request validation, and final export delivery.
