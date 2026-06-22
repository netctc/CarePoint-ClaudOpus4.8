# CarePoint Option B - Implementation V19

V19 adds release gates for observability coverage and feature-flag readiness. Node/Express remains owner of API, auth, RBAC/ABAC, Prisma, runtime routing and rollback. Python evaluates sanitized operational metadata and emits advisory artifacts only.

## Added jobs

- `platform.observability_coverage_review`: verifies request/trace correlation, p95/error/queue metrics, dashboard evidence and log correlation before canary promotion.
- `platform.feature_flag_review`: verifies kill switch, shadow mode, canary cap, Python base URL and signed bridge requirement. Secret-like flag values are redacted in artifacts.

## New Node bridge routes

- `POST /api/hybrid-python/platform/observability/coverage/review/prepare`
- `POST /api/hybrid-python/platform/feature-flags/review/prepare`

## Release rule

Do not increase canary unless both gates pass, contract replay passes, privacy preflight passes, SLO regression allows advance, and rollback drill evidence is attached.
