# PILOT-V2 — Staging Deployment Rehearsal

## Purpose

This delivery prepares CarePoint for a controlled pilot or go-live execution by proving that the selected release package can be staged, configured, smoked, monitored, and rolled back under governance.

PILOT-V2 does not reopen implementation, UX, or QA/UAT phases. It consumes QA-V7 readiness evidence and PILOT-V1 release gates to activate a controlled staging rehearsal path.

## Scope

PILOT-V2 covers:

- staging environment identity and ownership;
- release candidate freeze and checksum recording;
- dependency installation rehearsal;
- API and web build rehearsal;
- QA and pilot audit execution;
- Python worker verification path;
- environment variable and secret handling review;
- migration, backup, and restore rehearsal planning;
- smoke test readiness;
- observability/support activation;
- rollback rehearsal;
- go/no-go decision preparation for PILOT-V3.

## Recommended rehearsal command sequence

```bash
npm install
npm run build:api
npm run build:web
npm run audit:qa
npm run audit:pilot
PYTHONPATH=services/python-worker python scripts/option_b/verify_python_worker.py
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=services/python-worker python -m pytest -q services/python-worker/tests/test_worker_contracts.py --disable-warnings
```

On Windows, use `python` or `python3` according to your installed Python alias.

## Exit criteria

PILOT-V2 may be considered complete when:

1. the staging environment has a documented owner, URL, support window and data policy;
2. environment variables are reviewed against `.env.example`;
3. secrets are confirmed outside the repository;
4. `npm run build:api` and `npm run build:web` pass in the target environment;
5. `npm run audit:qa` and `npm run audit:pilot` pass;
6. Python worker verification and contract tests pass;
7. backup, migration and rollback actions are documented;
8. Admin, Provider, API and Python worker smoke coverage is ready;
9. support and observability channels are active;
10. a continue/hold/retry/rollback decision can be recorded for PILOT-V3.

## Decision states

- `continue`: all P0 gates pass and the team can prepare the day-0/day-1 launch runbook.
- `hold`: controlled launch is paused pending owner/date for remaining gaps.
- `retry-rehearsal`: rehearsal is repeated after an environment or build correction.
- `rollback`: staging activation is reverted and evidence is preserved.
