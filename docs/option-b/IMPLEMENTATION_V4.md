# Option B - Hybrid Python Progressive: Implementation V4

## Purpose

V4 turns the Python worker from a job execution sidecar into a controlled canary migration plane. Node/Express remains the owner of API routing, authentication, RBAC/ABAC, Prisma and production object authorization. Python now provides the additional guardrails required to compare Node-vs-Python outcomes before any domain cutover.

This version addresses the architecture report recommendations to keep the modular monolith, move heavy exports/jobs out of the API request path, use contracts as the source of truth, add observability and evolve based on measurement rather than a speculative rewrite.

## Added capabilities

### 1. Shadow result comparison

Python now exposes a sanitized comparison registry:

- `POST /api/v1/shadow/comparisons/record`
- `GET /api/v1/shadow/comparisons`

Node exposes the same control plane through the authenticated bridge:

- `POST /api/hybrid-python/shadow/comparisons`
- `GET /api/hybrid-python/shadow/comparisons`

The comparison store computes stable hashes for sanitized Node and Python results, ignores volatile fields such as timestamps/request IDs, and classifies outcomes as:

- `match`
- `shape_mismatch`
- `value_mismatch`

Payloads containing bridge secrets, bearer tokens or high-risk clinical fields are rejected before storage.

### 2. Canary gate decision

Python now exposes:

- `GET /api/v1/canary/gate`

Node exposes:

- `GET /api/hybrid-python/canary/gate`

The gate combines job summary and shadow comparison summary to recommend one of three actions:

- `advance`: thresholds passed and enough comparisons exist.
- `hold`: not enough evidence yet.
- `rollback`: mismatch or failure thresholds exceeded.

Default thresholds:

- `maxMismatchRate=0.05`
- `maxFailedJobs=0`
- `minComparisons=10`

Rollout owners can tune these per call during staged rollout.

### 3. Artifact retention garbage collection

Python now exposes:

- `POST /api/v1/artifacts/gc?dryRun=true|false`

Node exposes:

- `POST /api/hybrid-python/artifacts/gc`

The GC scans artifact metadata and deletes expired artifacts only when `dryRun=false`. The default remains safe/dry-run.

### 4. Contracts updated

`packages/contracts` now includes schemas and types for:

- `hybridPythonShadowComparisonInputSchema`
- `hybridPythonShadowComparisonRecordSchema`
- `hybridPythonShadowComparisonSummarySchema`
- `hybridPythonCanaryGateSchema`
- `hybridPythonArtifactGcSchema`

## Operational flow

1. Keep `HYBRID_PYTHON_ENABLED=false` or a very low canary value.
2. Send production Node results and Python dry-run results to `/shadow/comparisons` after sanitization.
3. Watch `GET /api/hybrid-python/shadow/comparisons` for mismatches.
4. Query `GET /api/hybrid-python/canary/gate` before increasing canary percent.
5. Advance only when the gate returns `recommendation=advance`.
6. If the gate returns `rollback`, set `HYBRID_PYTHON_ENABLED=false` and keep Node as owner.

## Validation executed

```bash
npm run check:secrets --silent
npm run verify:workspace --silent
npm run verify:python-worker --silent
cd services/python-worker && python3 -m pytest -q
```

Python tests: `15 passed`.

## Notes and limits

- Result comparison is intentionally limited to sanitized non-PHI output snapshots.
- Node remains responsible for production authorization and object-scope checks.
- Python does not become a direct owner of Prisma/PostgreSQL tables in V4.
- The artifact GC defaults to dry-run to prevent accidental deletion.
