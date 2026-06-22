# QA-V6 - Production Readiness and Go-Live Review

## Purpose

QA-V6 prepares CarePoint for pilot, staging signoff, or production go-live after QA-V1 through QA-V5 have established the master QA plan, Admin QA, Provider QA, API/Python integration validation, and UAT role acceptance package.

This delivery is QA-artifact-only. It does not change backend contracts, Python worker logic, database structure, or application runtime behavior.

## Production readiness scope

QA-V6 covers eight readiness domains:

1. Environment and configuration.
2. Build and release package.
3. Database, migration, seed, and backup.
4. Security and privacy smoke.
5. Observability, monitoring, and support readiness.
6. Rollback and continuity.
7. UAT signoff consumption.
8. Go-live or pilot decision.

## Required target-environment evidence

Before final signoff, archive command output for:

```bash
npm install
npm run build:api
npm run build:web
npm run audit:qa
PYTHONPATH=services/python-worker python scripts/option_b/verify_python_worker.py
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=services/python-worker python -m pytest -q services/python-worker/tests/test_worker_contracts.py --disable-warnings
npm run check:secrets
npm run verify:workspace
```

## Exit criteria

- QA-V1 through QA-V5 evidence is present and complete.
- No unresolved P0 defect remains open.
- P1/P2 deferrals have owner, mitigation, and target follow-up.
- Environment, migration, backup, rollback, monitoring, and hypercare owners are named.
- Go/no-go decision is recorded before promotion.

## Generated evidence

- `validation/qa/qa-v6-production-readiness-audit.json`
- `validation/qa/qa-v6-go-live-checklist.json`
