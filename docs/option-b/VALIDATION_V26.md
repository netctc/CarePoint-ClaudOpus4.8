# Option B Python Progressive V26 Validation

## Completed locally

Run from the repository root or from `services/python-worker` with `PYTHONPATH=.`:

```bash
python -m compileall services/python-worker/carepoint_python_worker
cd services/python-worker
PYTHONPATH=. pytest -q tests/test_worker_contracts.py
```

Expected smoke results:

- `platform.access_control_review.completed` with `decision=pass` for clean RBAC/ABAC/BOLA/cross-org negative-test evidence
- `platform.data_quality_review.completed` with `decision=pass` for clean freshness/null/duplicate/schema/redaction aggregate metrics
- contract manifest schema version is `2026-05-option-b-v26`
- contract vectors include V25 and V26 release gates

## Required CI/staging validation

The TypeScript build still needs to be certified in an environment with dependencies installed:

```bash
npm ci
npm run build --workspace @care-center/contracts
npm run build --workspace @care-center/api
```

End-to-end staging checks:

1. Start Node, Python API, Celery and Redis together.
2. Enable signed bridge traffic.
3. POST to `/api/hybrid-python/platform/access-control/review/prepare` with sanitized authz evidence.
4. POST to `/api/hybrid-python/platform/data-quality/review/prepare` with aggregate data quality metrics.
5. Confirm artifacts are redacted, checksummed and TTL-bound.
6. Confirm `hold`/`rollback` decisions block canary expansion in the release checklist.
