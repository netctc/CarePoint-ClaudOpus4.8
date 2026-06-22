# Option B Python Progressive V31 Implementation

V31 is cumulative on V30 and adds sustained-traffic readiness gates before moving from expanded canary to steady usage.

## New gates

- `platform.third_party_dependency_review` evaluates sanitized external dependency health, rate-limit headroom, vendor incident/status-page signals and failover readiness.
- `platform.capacity_scaling_readiness_review` evaluates aggregate worker/API/queue capacity, autoscaling readiness and load-test evidence.

## Node bridge routes

- `/api/hybrid-python/platform/third-party/dependencies/review/prepare`
- `/api/hybrid-python/platform/capacity/scaling/readiness/review/prepare`

Both routes are dry-run/advisory and enqueue Python jobs through the signed hybrid bridge. Node/control-plane remains owner of vendor configuration, infrastructure scaling, feature flags, canary percentages and rollback execution.
