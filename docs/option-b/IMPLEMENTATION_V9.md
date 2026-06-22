# CarePoint Option B - Implementation V9

## Scope

V9 adds platform/DevOps intelligence slices to the progressive Python hybrid path. Node/Express still owns auth, RBAC/ABAC, Prisma queries, schema migrations, production API behavior and rollback. Python now helps with two advisory workloads:

1. `platform.db_index_advisory` - analyzes schema/query metadata and proposes Prisma index candidates for high-latency or full-scan query shapes.
2. `platform.slo_regression_report` - evaluates aggregate latency/error samples and emits an `advance`, `hold` or `rollback` recommendation for canary review.

Both workloads are dry-run-only and use metadata/aggregate telemetry only. They are designed to support the original architecture report recommendations around indexes, p95/p99 measurement, pg_stat_statements, observability and canary promotion evidence.

## New Node bridge routes

- `POST /api/hybrid-python/platform/db-index-advisory/prepare`
- `POST /api/hybrid-python/platform/slo-regression/report/prepare`

## New Python contracts

- `cp.hybrid.platform.db_index_advisory.v1`
- `cp.hybrid.platform.slo_regression_report.v1`

## Safety rules

- No DB connection from Python for index advisory.
- No Prisma migration writes from Python.
- No raw request logs, headers, tokens, PHI or payment payloads in SLO reports.
- SLO output is advisory but can be attached to release evidence and used by operators before increasing canary.

## Validation

```bash
npm run check:secrets --silent
npm run verify:workspace --silent
npm run verify:python-worker --silent
cd services/python-worker && python3 -m pytest -q
```
