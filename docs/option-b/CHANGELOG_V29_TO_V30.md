# Changelog V29 to V30

## Added

- `platform.slo_error_budget_review` for formal SLO/error-budget validation before further traffic expansion.
- `platform.auto_rollback_safeguard_review` for automated rollback and feature-flag kill-switch safeguard verification.
- Python and TypeScript prepare contracts for both gates.
- Node bridge prepare routes and helper functions for both gates.
- Contract vectors and smoke tests for both V30 gates.

## Changed

- Python worker version: `0.29.0` -> `0.30.0`.
- Contract manifest schema: `2026-05-option-b-v29` -> `2026-05-option-b-v30`.
- Manifest capabilities now include SLO error-budget and auto-rollback safeguard reviews.

## Safety

Both V30 gates are dry-run/advisory and accept aggregate metadata only. Python does not mutate alerts, paging, feature flags, rollout percentages or rollback state.
