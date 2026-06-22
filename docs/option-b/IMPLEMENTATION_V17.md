# CarePoint Option B - Implementation V17

V17 adds security and supply-chain release gates to the hybrid Python path while preserving the Option B ownership model: Node/Express owns API, auth, RBAC/ABAC, Prisma, traffic, deployment and rollback; Python evaluates sanitized evidence and produces advisory artifacts.

## Added job types

- `platform.security_posture_review`
- `platform.supply_chain_review`

## Node bridge routes

- `POST /api/hybrid-python/platform/security/posture/review/prepare`
- `POST /api/hybrid-python/platform/supply-chain/review/prepare`

## Python behavior

Security posture review checks required controls such as signed bridge, CSRF/rate-limit coverage, object-level authorization tests, secret scanning, production CORS whitelist and httpOnly cookies. Supply-chain review checks SBOM evidence, lockfiles, container/image scan evidence and aggregated vulnerability counts.

Both gates are dry-run-only, advisory, artifact-generating and release-gate oriented.
