# Option B Python Progressive V29

V29 is cumulative on V28 and adds post-canary promotion governance gates.

## Added gates

- `platform.traffic_promotion_readiness_review`: advisory review of traffic promotion readiness. Requires bounded step, clean production/incident evidence, ready rollback plan, no active freeze window and operator approval.
- `platform.evidence_retention_audit_review`: advisory audit of artifact metadata, checksums, redaction flags, piiClass, protected download metadata and retention evidence.

## Versioning

- Python worker version: `0.29.0`
- Contract manifest schema: `2026-05-option-b-v29`

## Node bridge routes

- `/api/hybrid-python/platform/traffic/promotion/readiness/review/prepare`
- `/api/hybrid-python/platform/evidence/retention/audit/review/prepare`
