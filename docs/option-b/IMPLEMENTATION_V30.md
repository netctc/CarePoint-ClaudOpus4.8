# Option B Python Progressive V30

V30 is cumulative on V29 and adds post-promotion SRE controls before expanding traffic beyond the governed canary stage.

## Added gates

- `platform.slo_error_budget_review` evaluates aggregate SLO/error-budget telemetry: availability, p95 latency, error rate, burn rate, error-budget remaining, sample size and alert coverage.
- `platform.auto_rollback_safeguard_review` verifies rollback controls: automatic triggers, manual override, Node fallback, feature-flag kill switch, rollback runbook and recent drill evidence.

## Ownership boundary

Both gates are dry-run/advisory. Python produces sanitized reports and artifacts only. Node/control-plane remains owner of auth, RBAC/ABAC, rollout percentages, feature flags, alert/paging changes and rollback execution.

## Routes

- `/api/hybrid-python/platform/slo/error-budget/review/prepare`
- `/api/hybrid-python/platform/auto-rollback/safeguard/review/prepare`

## Version

- Python worker version: `0.30.0`
- Contract manifest schema: `2026-05-option-b-v30`
