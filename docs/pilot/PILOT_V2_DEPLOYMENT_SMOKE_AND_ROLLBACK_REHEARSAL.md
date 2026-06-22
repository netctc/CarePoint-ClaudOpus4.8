# PILOT-V2 — Deployment Smoke and Rollback Rehearsal

## Smoke coverage

The staging smoke should include at minimum:

1. Admin sign-in and protected route access.
2. Provider sign-in and protected route access.
3. Admin accounts/configuration surface loads.
4. Provider dashboard loads.
5. Provider queue or clinical worklist loads.
6. Provider calendar loads.
7. Prescription or encounter-note critical form loads.
8. API build and contract-compatible route availability.
9. Hybrid Python prepare endpoint coverage from QA-V4 remains available.
10. Python worker verification passes.
11. Audit/observability evidence can be captured.
12. Support escalation path is live.

## Rollback rehearsal

The rollback rehearsal is a decision walk-through. It does not require destructive production behavior in this package.

### Required rollback questions

- Who can declare rollback?
- Which P0 events trigger rollback?
- Where is the latest backup evidence?
- Which service or release artifact is restored?
- How is the pilot cohort notified?
- How is evidence preserved for post-incident review?

## Rollback trigger map

| Trigger | Default action |
|---|---|
| Authentication outage for pilot users | hold or rollback |
| Data corruption or suspected data loss | rollback |
| Role boundary failure | rollback |
| Clinical workflow blocker | hold or rollback |
| API/worker failure blocking pilot workflow | retry or rollback |
| Unresolved P0 defect | hold |
| Repeated severe support incidents | hold or rollback |
| Inability to capture evidence | hold |

## PILOT-V3 handoff

PILOT-V3 should not start until the rehearsal result is recorded as `continue`, or until any `hold`/`retry-rehearsal` items have assigned owners and dates.
