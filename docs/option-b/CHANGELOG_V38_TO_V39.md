# Changelog V38 to V39

## Added

- Phase 2 domain adoption readiness advisory gate.
- Phase 2 rollout governance advisory gate.
- Python/TypeScript contracts for the new gates.
- Node bridge helper functions and prepare routes.
- Contract vectors and smoke tests for both gates.

## Updated

- Worker version: `0.39.0`
- Contract schema: `2026-05-option-b-v39`
- Contract vectors: +2 cumulative vectors

## Safety

Both gates are dry-run/advisory. Python does not mutate routing, flags, cohorts, approvals, communications, support configuration or production data.
