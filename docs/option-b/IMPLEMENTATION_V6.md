# CarePoint Option B - Implementation V6

## Purpose

V6 closes the loop between the Python canary control plane and the Node API bridge. V5 introduced rollout planning and deterministic assignment. V6 makes that assignment consumable by Node, adds route-scoped rollout actions, and produces release evidence that operators can inspect before increasing Python traffic.

## Added capabilities

- Node can optionally resolve canary routing through Python rather than only the local `HYBRID_PYTHON_CANARY_PERCENT` flag.
- Rollout actions now include a `route` field, allowing separate staged rollout for `/api/hybrid-python/jobs`, audit exports, bulk validation, analytics, notifications, or future domain pilots.
- Python exposes a release checklist at `/api/v1/release/checklist`.
- Python exposes an evidence bundle at `/api/v1/evidence/bundle`.
- Node exposes bridge routes: `GET /api/hybrid-python/release/checklist` and `GET /api/hybrid-python/evidence/bundle`.
- Contracts include `hybridPythonRoutingDecisionSchema`, route-scoped rollout actions, release checklist reports, and evidence bundles.

## New environment flags

```bash
HYBRID_PYTHON_USE_CONTROL_PLANE_ASSIGNMENT=false
HYBRID_PYTHON_CONTROL_PLANE_FAIL_OPEN=false
HYBRID_PYTHON_DEFAULT_ROUTE=/api/hybrid-python/jobs
```

Recommended order: validate status, run shadow-only, plan route-specific rollout with `dryRun=false`, enable control-plane assignment in staging, inspect release checklist/evidence, then advance canary.

## Fail-safe behavior

By default `HYBRID_PYTHON_CONTROL_PLANE_FAIL_OPEN=false`. If Node cannot reach the Python control plane for assignment, Node fails closed for Python routing and keeps the request in the Node path while preserving shadow mode.
