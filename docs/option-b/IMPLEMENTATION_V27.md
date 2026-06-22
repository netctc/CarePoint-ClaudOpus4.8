# Option B Python Progressive V27 - Stage Closure Gates

V27 is cumulative and is built on the delivered V26 package. V25 and V26 added the missing FinOps, environment parity, access control and data quality gates. V27 adds the closure layer required to finish the V24+ implementation stage without moving production ownership away from Node.

Node remains the owner of authentication, RBAC/ABAC, object scope, Prisma reads/writes, delivery, deployment, rollback and change approval. Python remains an advisory worker/control-plane surface that receives sanitized evidence and returns deterministic release-gate reports.

## Added job types

### `platform.ci_staging_validation_review`

Purpose: evaluate sanitized CI/staging evidence for the technical closure checklist before any canary increase.

Covered evidence:

- `npm ci`
- `build:contracts`
- `build:api`
- Python worker tests
- Docker/Compose smoke
- signed HMAC bridge behavior
- Redis job status store persistence
- artifact registry integrity/redaction/expiry
- canary assignment and rollback
- observability coverage
- Node bridge route mounting

Result type: `platform.ci_staging_validation_review.completed`.

Decision model:

- `pass`: all required evidence is present and clean.
- `hold`: no blockers, but evidence is inconclusive or warning-level.
- `rollback`: required evidence is missing or failing.

### `platform.release_closure_review`

Purpose: produce a final advisory closure decision for the stage using sanitized gate summaries, evidence bundle references, known risks and approvals.

Default required gates:

- `costGuardrail`
- `environmentParity`
- `accessControl`
- `dataQuality`
- `ciStagingValidation`
- `releaseDecision`
- `rollbackDrill`
- `postDeployVerify`
- `changeTicketBundle`

Result type: `platform.release_closure_review.completed`.

Decision model:

- `pass`: all required gates are clean, evidence bundle exists, and release approval is present.
- `hold`: non-critical known risks or warning evidence remain.
- `rollback`: required gates are missing/failing, evidence bundle is missing, approval is missing, or high/critical risks remain open.

## Contract and routing updates

V27 updates:

- Python worker version: `0.27.0`
- Python contract manifest schema version: `2026-05-option-b-v27`
- contract test vectors: 49 cumulative vectors
- Node bridge prepare routes:
  - `/api/hybrid-python/platform/ci-staging/validation/review/prepare`
  - `/api/hybrid-python/platform/release/closure/review/prepare`
- TypeScript contract schemas:
  - `hybridPythonPlatformCiStagingValidationReviewPrepareSchema`
  - `hybridPythonPlatformReleaseClosureReviewPrepareSchema`
- Node helper functions:
  - `runHybridPythonCiStagingValidationReview`
  - `runHybridPythonReleaseClosureReview`

## Safety and ownership

Both V27 gates are dry-run/advisory-only. They do not:

- run CI commands;
- start Docker services;
- perform smoke traffic;
- mutate Redis, rollout state or artifact storage;
- approve release tickets;
- deploy or rollback production.

They only evaluate sanitized metadata and produce redacted JSON artifacts that can be attached to the release ticket.
