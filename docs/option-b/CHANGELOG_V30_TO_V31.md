# Changelog V30 to V31

## Added

- `platform.third_party_dependency_review` for third-party/vendor dependency readiness before sustained traffic expansion.
- `platform.capacity_scaling_readiness_review` for worker/API/queue capacity and autoscaling readiness.
- Python and TypeScript contracts for both gates.
- Node bridge prepare routes and helper functions for both gates.
- Contract vectors and smoke tests for both gates.

## Safety posture

Both gates are dry-run/advisory. Python never mutates vendor configuration, autoscaling settings, feature flags, rollout state or infrastructure.
