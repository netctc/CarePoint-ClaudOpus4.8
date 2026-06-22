# Option B v3 validation notes

Date: 2026-05-05

## Checks passed in this package

```bash
npm run check:secrets --silent
npm run verify:workspace --silent
npm run verify:python-worker --silent
cd services/python-worker && python3 -m pytest -q
```

Python worker test coverage in v3 includes:

- Service metadata and manifest capability contract.
- Policy manifest and data minimization guardrails.
- Audit export dry-run preparation, artifact metadata and job status lookup.
- Idempotent job replay.
- Bulk account validation with row-level errors and report artifact.
- Non-diagnostic AI triage preview guardrails.
- Metrics snapshot and shadow traffic inspection.
- HMAC bridge signature verification and replay-window rejection.
- Non-dry-run queue guard when Celery dispatch is disabled.

## Node build note

The package includes Node bridge and shared TypeScript contract changes, but a full TypeScript build still requires a normal dependency install from `package-lock.json`:

```bash
npm ci
npm run build:contracts
npm run build:api
npm run build:admin
npm run build:provider
```

## Rollback

Python routing remains flag-controlled. Disable without code rollback:

```bash
HYBRID_PYTHON_ENABLED=false
HYBRID_PYTHON_CANARY_PERCENT=0
HYBRID_PYTHON_SHADOW_MODE=false
PYTHON_WORKER_QUEUE_ENABLED=false
```

V3 does not transfer database ownership to Python. Node remains owner of auth, RBAC, Prisma writes, export delivery and object-scope enforcement.
