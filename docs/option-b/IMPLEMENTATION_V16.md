# CarePoint Option B - Implementation V16

## Focus

V16 adds compliance-oriented release gates for the hybrid Python path without moving production ownership away from Node/Express. Python remains advisory and dry-run for these gates.

## Added job types

- `platform.data_retention_review`
- `platform.audit_trail_review`

## Data retention review

Node or CI supplies sanitized retention metadata, artifact summaries, job summaries and GC dry-run evidence. Python checks whether every artifact class has explicit TTLs, whether TTLs stay below the configured cap, whether redaction is required, and whether artifact summary signals indicate unredacted or high-risk artifacts.

The output is `platform.data_retention_review.report`. Python does not delete artifacts or change retention policy.

## Audit trail review

Node or CI supplies sanitized audit event metadata for rollout, canary, artifact access and release operations. Python validates required fields such as actor, correlation ID, route and timestamp. Mutation-like events should include `dryRun=true` or an operator `approvalId`.

The output is `platform.audit_trail_review.report`. Python does not write audit logs or approve releases.

## Node bridge routes

- `POST /api/hybrid-python/platform/data-retention/review/prepare`
- `POST /api/hybrid-python/platform/audit-trail/review/prepare`

## Rollback

Keep `HYBRID_PYTHON_ENABLED=false` or route-specific canary at 0 if either gate returns `rollback`. Node/Express remains the production fallback and owner of traffic, auth, RBAC/ABAC, Prisma and deployment rollback.
