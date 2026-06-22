# PILOT-V1 - Controlled Pilot / Go-Live Execution Charter

## Purpose

PILOT-V1 starts **CarePoint Phase 4 - Controlled Pilot / Go-Live Execution** from the closed QA-V7 baseline. The goal is to prepare a governed launch path before any real pilot, staging signoff, or production go-live activity begins.

## Delivery count for Phase 4

Recommended total: **6 deliveries**.

1. **PILOT-V1** - Pilot execution charter, scope, gates, and cohort plan.
2. **PILOT-V2** - Staging deployment rehearsal and environment activation.
3. **PILOT-V3** - Controlled pilot launch runbook and day-0/day-1 execution.
4. **PILOT-V4** - Pilot monitoring, support, incident triage, and daily health review.
5. **PILOT-V5** - Pilot feedback, defect burn-down, adoption evidence, and expansion decision.
6. **PILOT-V6** - Final go-live execution certificate and phase closure.

## Entry criteria

- QA-V7 final closure package exists.
- QA phase manifest is closed.
- QA-V7 readiness position is ready for controlled go-live or pilot.
- `npm run audit:qa` remains available.
- `npm run build:api` remains available.
- Python worker verification scripts remain available.

## Pilot governance roles

| Role | Responsibility |
|---|---|
| Pilot owner | Owns pilot scope, timing, cohort, and daily pilot decision. |
| Release owner | Owns deployment gate, rollback decision, and go/no-go signoff. |
| Clinical/business owner | Confirms pilot workflow acceptance and user readiness. |
| Support owner | Owns issue intake, escalation, daily support review, and comms. |
| Technical owner | Owns environment health, logs, integrations, and emergency triage. |
| QA/UAT owner | Confirms QA-V7 evidence remains valid during pilot execution. |

## Pilot execution principle

The pilot should start with a limited operational blast radius. Recommended limits:

- limited user cohort;
- limited operational window;
- limited site or tenant scope;
- controlled data set;
- rollback plan approved before launch;
- support coverage available during the first usage window.

## Non-goals

- Do not add new product functionality in PILOT-V1.
- Do not change backend contracts.
- Do not change Python worker behavior.
- Do not change database schema.
- Do not re-open UX or QA unless a blocking pilot defect is discovered.
