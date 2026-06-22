# Changelog V31 to V32

## Added

- `platform.compliance_privacy_evidence_review`
- `platform.runbook_drill_verification_review`
- Python payload models and processors for both gates
- TypeScript prepare schemas for both gates
- Node bridge routes and helper functions
- Contract definitions, policies, routing entries and cumulative contract vectors
- V32 validation and sustained operations readiness documentation

## Changed

- Worker version bumped from `0.31.0` to `0.32.0`
- Contract schema version bumped from `2026-05-option-b-v31` to `2026-05-option-b-v32`
- Contract vector count increased from 57 to 59

## Ownership preserved

- Node/control-plane remains owner of auth, RBAC/ABAC, rollout mutation and production writes.
- Compliance/privacy owners remain responsible for approvals, DPA/DPIA decisions and artifact access policy.
- SRE/operators remain responsible for drills, runbook updates, incidents, tickets and paging.
- Python only produces advisory reports and redacted evidence artifacts.
