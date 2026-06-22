# Option B V11 - Release decision and rollback drill

## Scope

V11 adds release decision automation around the progressive Python rollout without moving ownership away from Node/Express. The Python worker can now prepare two new advisory artifacts:

- `platform.release_decision`: evaluates sanitized evidence from canary gate, release checklist, contract replay, privacy preflight, SLO regression and rollout state.
- `platform.rollback_drill`: generates a dry-run rollback drill plan for a selected route/job type set.

## Ownership boundaries

Node/Express remains owner of API, auth, RBAC/ABAC, Prisma, source queries, mutating workflows and deployment switches. Python only evaluates metadata and writes local artifacts for change-ticket evidence.

## New Node routes

- `POST /api/hybrid-python/platform/release/decision/prepare`
- `POST /api/hybrid-python/platform/rollback/drill/prepare`

## New contract schema

`schemaVersion=2026-05-option-b-v11`, Python worker `0.11.0`.

## Rollback

Disable or roll back hybrid traffic with the existing rollout controller or environment switches. V11 jobs do not mutate rollout state by design.
