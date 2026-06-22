# QA-V4 Integration Test Plan

## Overview

The QA-V4 integration test plan defines technical end-to-end validation scenarios for the Node/API/Python worker boundary.

The canonical machine-readable plan is generated at:

```text
validation/qa/qa-v4-api-python-e2e-test-plan.json
```

## Scenario groups

The generated plan contains 22 scenarios grouped into:

- Workspace build.
- Route readiness.
- Idempotency.
- Shared contracts.
- Node helper readiness.
- Python worker verification.
- Python worker contract tests.
- Cross-boundary error handling.
- Evidence and traceability.
- Security smoke.
- Observability.
- Production readiness.

## Evidence requirements

Each scenario requires:

- tester;
- environment;
- date;
- command or endpoint under test;
- steps executed;
- expected result;
- actual result;
- pass/fail;
- log output or screenshot reference when applicable;
- linked defect id when failed.

## P0 acceptance

All P0 scenarios must pass before production readiness signoff. P1 scenarios must be triaged and either resolved, accepted with risk, or moved into the post-readiness backlog.
