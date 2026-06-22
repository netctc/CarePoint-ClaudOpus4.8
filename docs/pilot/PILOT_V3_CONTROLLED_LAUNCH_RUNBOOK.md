# PILOT-V3 — Controlled Pilot Launch Runbook

## Purpose

PILOT-V3 defines the controlled pilot launch execution path for CarePoint after QA/UAT closure and staging rehearsal. It converts the readiness evidence from QA-V7, PILOT-V1 and PILOT-V2 into an executable day-0/day-1 launch plan.

This package does not reopen implementation, UX, QA/UAT, backend contracts, Python worker code, database schema, or application runtime code. It adds launch governance, execution evidence, decision states and support operating structure.

## Entry criteria

Before launch execution, the following must be true:

1. Phase 1 Option B Python Progressive is closed at V64.
2. Phase 2 UX is closed at UX-V6.
3. Phase 3 QA/UAT is closed at QA-V7.
4. PILOT-V1 execution charter is complete.
5. PILOT-V2 staging rehearsal and environment activation evidence is complete.
6. Release candidate, checksum and target environment are identified.
7. Pilot cohort, support channel and escalation owners are confirmed.
8. Rollback authority and pause criteria are known.

## Launch gates

| Gate | Owner | Severity | Required evidence |
|---|---|---:|---|
| Release candidate frozen | Release owner | P0 | selected ZIP/checksum and target |
| QA/UAT closure evidence accepted | QA/UAT owner | P0 | QA-V7 closure and acceptance package |
| Staging rehearsal passed | Pilot owner | P0 | PILOT-V2 rehearsal audit |
| Pilot cohort confirmed | Pilot owner | P0 | users, roles, support contacts |
| Support command center active | Support owner | P0 | support channel and escalation path |
| Rollback and pause authority confirmed | Release owner | P0 | rollback owner, triggers and backup evidence |
| Day-0 smoke path ready | QA/UAT owner | P0 | Admin, Provider, API and Python smoke path |
| Day-1 monitoring window scheduled | Pilot owner | P1 | health review and triage time |

## Decision states

The launch owner records one of:

```text
continue
hold
rollback
retry-launch
hotfix-required
```

## Exit criteria

PILOT-V3 is complete when:

- day-0 execution is recorded;
- Admin, Provider and API/Python smoke checks have an outcome;
- support command center is active;
- pilot cohort access has been activated or explicitly held;
- day-1 monitoring and triage are scheduled;
- any P0/P1 issues are assigned owners and decision state;
- the phase is ready for PILOT-V4 monitoring and incident triage.
