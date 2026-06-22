# Option B Hybrid Python Progressive - Implementation V20

## Scope
V20 adds final domain cutover preparation gates without changing the ownership model. Node/Express remains owner of API, auth, RBAC/ABAC, Prisma, production traffic, deployment and rollback. Python evaluates sanitized release evidence and produces advisory artifacts.

## Added jobs

### platform.domain_migration_readiness
Evaluates whether a specific domain/route/job type is ready to move from shadow or small canary toward a larger canary stage. Inputs are sanitized evidence sections: contract replay, privacy preflight, SLO regression, observability, feature flags, production readiness, shadow comparison summary, canary gate and Node fallback evidence.

### platform.cutover_plan
Builds a dry-run staged cutover plan with canary percentages, verification points, rollback triggers and operator approval metadata. It does not mutate rollout state.

## New Node bridge routes
- `POST /api/hybrid-python/platform/domain-migration/readiness/prepare`
- `POST /api/hybrid-python/platform/cutover/plan/prepare`

## Safety boundaries
- Python does not execute traffic promotion, deployment or rollback.
- Python does not write Prisma migrations or update feature flags.
- Payloads must be release evidence metadata only, with no tokens, PHI, raw logs, headers or request bodies.
