# PILOT-V3 — Communication and Support Command Center

## Command center objective

The support command center ensures pilot users have a single route for help, defects are triaged consistently, and launch decisions are documented without relying on informal messages.

## Roles

| Role | Responsibility |
|---|---|
| Pilot owner | Owns launch decision, cohort communication and daily pilot status. |
| Release owner | Owns release activation, rollback and environment decision support. |
| Technical owner | Owns API, worker, logs, data handling and technical diagnostics. |
| QA/UAT owner | Owns smoke evidence, defect severity and test traceability. |
| Support owner | Owns user support intake, escalation and incident communications. |

## Required communications

| Audience | Timing | Message |
|---|---|---|
| Pilot cohort | Before access activation | Scope, supported workflows, known limits and support channel. |
| Support command center | During day-0 launch | Severity matrix, escalation owner and evidence process. |
| Technical/release owners | Day-0 and day-1 | Deployment state, risks, rollback triggers and decision updates. |
| Stakeholders | Day-1 close | Pilot health, defects, feedback, adoption evidence and next action. |

## Incident severity baseline

| Severity | Example | Expected action |
|---|---|---|
| P0 | auth outage, data issue, role boundary failure, critical workflow blocked | pause or rollback decision |
| P1 | severe degradation, evidence/logging gap, repeated support issue | hold or hotfix decision |
| P2 | non-critical UX defect, documentation gap, non-blocking workflow issue | backlog or scheduled fix |

## Support evidence fields

Each support item should capture:

- date/time;
- reporter/role;
- environment;
- workflow;
- expected behavior;
- actual behavior;
- severity;
- owner;
- decision;
- screenshot/log reference when applicable.
