# Changelog V28 to V29

## Added

- `platform.traffic_promotion_readiness_review` processor, contract, policy, test vector, Node bridge helper and prepare route.
- `platform.evidence_retention_audit_review` processor, contract, policy, test vector, Node bridge helper and prepare route.

## Changed

- Python worker version: `0.28.0` -> `0.29.0`.
- Contract manifest schema: `2026-05-option-b-v28` -> `2026-05-option-b-v29`.

## Safety

Both V29 gates are dry-run/advisory. Python does not mutate rollout percentages, feature flags, traffic routing, artifact storage or retention policies.
