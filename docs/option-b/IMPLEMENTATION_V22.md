# Option B implementation V22 - Legacy path decommission and steady-state operations review

V22 adds the final operational maturity layer after post-cutover monitoring. The intent is not to move ownership away from Node automatically. Node/Express, CI and operators remain owners of production routing, route removal, rollback and on-call changes. Python produces advisory evidence bundles only.

## New job types

- `platform.legacy_path_decommission`
  - Reviews whether an old Node/hybrid path can be safely decommissioned after a successful cutover.
  - Requires zero traffic, replacement route, fallback plan, rollback evidence, owner approval and clean post-cutover evidence.
  - Produces `platform.legacy_path_decommission.report`.

- `platform.steady_state_operations_review`
  - Reviews whether a migrated slice has enough operational evidence to be treated as steady-state.
  - Checks runbooks, dashboards, alert policies, on-call evidence, owner registry, rollback drill, post-cutover monitor, aggregate SLOs and incident history.
  - Produces `platform.steady_state_operations_review.report`.

## New Node bridge routes

- `POST /api/hybrid-python/platform/legacy-paths/decommission/prepare`
- `POST /api/hybrid-python/platform/steady-state/ops/review/prepare`

## Guardrails

- Dry-run only.
- Metadata only.
- No route removal.
- No feature flag mutation.
- No traffic mutation.
- No on-call or ownership mutation.
- Node fallback remains authoritative until operators explicitly remove it through normal release/change management.
