# Option B Python Progressive V26 - Access Control and Data Quality Gates

## Base

V26 is cumulative and is built on the delivered V25 package. It keeps Node as the productive owner of auth, RBAC/ABAC, Prisma queries, source data reads, mutations, traffic routing and rollback. Python remains an advisory worker/control-plane surface.

## Added gates

### `platform.access_control_review`

Reviews sanitized authorization evidence before rollout expansion:

- RBAC control evidence
- ABAC/organization-scope policy evidence
- object-level authorization/BOLA negative tests
- cross-org negative tests
- release evidence statuses

The gate emits `pass`, `hold`, or `rollback` and writes a redacted artifact of type `platform.access_control_review.report`. Python does not evaluate live permissions and does not mutate authorization state.

Node bridge route:

```text
/api/hybrid-python/platform/access-control/review/prepare
```

### `platform.data_quality_review`

Reviews aggregate data quality metadata before release promotion:

- freshness lag
- null rate
- duplicate rate
- schema version match
- redaction/classification evidence

The gate emits `pass`, `hold`, or `rollback` and writes a redacted artifact of type `platform.data_quality_review.report`. Python does not read raw source rows and does not repair schemas or data.

Node bridge route:

```text
/api/hybrid-python/platform/data-quality/review/prepare
```

## Contracts and policies

V26 updates:

- `JobType` enum
- Python contract manifest schema version: `2026-05-option-b-v26`
- built-in contract test vectors for V25 and V26 release gates
- TS Zod prepare schemas
- Node route handlers and Python enqueue helpers
- dry-run-only payload policies

## Operational rule

V26 gates are release blockers only when their advisory decision says `hold` or `rollback`. Operators/CI remain responsible for promotion, rollback, and remediation.
