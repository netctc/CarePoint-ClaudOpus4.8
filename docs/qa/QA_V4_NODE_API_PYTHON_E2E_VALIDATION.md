# QA-V4 - Node/API/Python Worker E2E Validation

## Purpose

QA-V4 validates the technical integration boundary between the Node API, the shared TypeScript contract package, and the Python worker before role-based UAT begins.

This delivery does not reopen the closed implementation phase. It adds QA evidence, validation scripts, test plans, and readiness documentation only.

## Scope

QA-V4 covers:

- Node/API build readiness.
- Shared contract package compatibility.
- Hybrid Python prepare route inventory.
- Hybrid Python helper coverage.
- Python worker verification readiness.
- Python worker contract test readiness.
- Dry-run/advisory metadata-only behavior evidence.
- Cross-boundary traceability using request and correlation identifiers.
- Evidence required before the UAT package in QA-V5.

## Technical boundary

The following remain unchanged:

- Backend contracts: unchanged.
- Python worker runtime logic: unchanged.
- Database schema: unchanged.
- Application runtime behavior: unchanged.
- Closed Option B phase: remains closed at V64.
- Closed UX phase: remains closed at UX-V6.

## Validation artifacts

QA-V4 adds:

- `scripts/qa/scan-api-python-e2e.mjs`
- `validation/qa/qa-v4-api-python-e2e-audit.json`
- `validation/qa/qa-v4-api-python-e2e-test-plan.json`

## Required local commands

Run these in the local development environment:

```bash
npm install
npm run build:contracts
npm run build:api
npm run audit:qa
python -m compileall -q services/python-worker/carepoint_python_worker
PYTHONPATH=services/python-worker python scripts/option_b/verify_python_worker.py
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=services/python-worker python -m pytest -q services/python-worker/tests/test_worker_contracts.py --disable-warnings
```

## Acceptance position

QA-V4 is accepted when:

- `npm run audit:qa` completes with 100% aggregate completion.
- API and contract build commands pass locally.
- Python worker verification passes locally.
- Python worker contract tests pass locally.
- Generated QA-V4 JSON reports are valid JSON.
- No runtime code changes are required to complete the evidence set.

## Next step

After QA-V4 passes locally, continue with QA-V5: UAT package and acceptance by role.
