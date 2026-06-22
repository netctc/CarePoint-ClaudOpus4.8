# Option B Python Progressive V36 Implementation

V36 is an accumulated release on top of V35. It keeps Node as the control plane for authentication, authorization, object scope, Prisma writes, incident systems, ticketing, backlog mutation and production traffic changes. Python remains an advisory/dry-run worker for evidence review and artifact generation.

## Added gates

### `platform.post_incident_learning_review`

Purpose: review sanitized post-incident learning evidence before sustained production expansion.

Inputs are limited to incident-class metadata, postmortem completion/linkage, owner acknowledgement, action-item status/age, regression guard outcomes and evidence decisions. Python does not mutate incident records, tickets, postmortems or remediation backlog.

Node prepare route:

```text
/api/hybrid-python/platform/post-incident/learning/review/prepare
```

### `platform.tech_debt_governance_review`

Purpose: review sanitized technical-debt governance metadata before sustained production expansion.

Inputs are limited to debt categories, severity, ownership acknowledgement, waiver status/age/expiry, remediation-plan status and evidence decisions. Python does not mutate backlog items, waivers or remediation plans.

Node prepare route:

```text
/api/hybrid-python/platform/tech-debt/governance/review/prepare
```

## Ownership boundaries

- Node/control-plane owns auth, RBAC/ABAC, organization scope, mutations, production rollout and durable source-of-truth writes.
- Python owns advisory review logic, contract validation, deterministic artifact generation and minimized evidence reports.
- V36 gates are dry-run only and return `pass`, `hold` or `rollback` decisions for release operators.

## Files touched

- `services/python-worker/carepoint_python_worker/models.py`
- `services/python-worker/carepoint_python_worker/contracts.py`
- `services/python-worker/carepoint_python_worker/policies.py`
- `services/python-worker/carepoint_python_worker/jobs/processors.py`
- `services/python-worker/carepoint_python_worker/services/job_router.py`
- `services/python-worker/carepoint_python_worker/main.py`
- `packages/contracts/src/index.ts`
- `services/api/src/lib/hybrid-python.ts`
- `services/api/src/modules/hybrid-python/hybrid-python.routes.ts`
- `services/python-worker/tests/test_worker_contracts.py`
- `scripts/option_b/verify_python_worker.py`
