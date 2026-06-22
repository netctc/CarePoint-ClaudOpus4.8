# PILOT-V4 - Monitoring, Support and Incident Triage

## Purpose

PILOT-V4 moves the controlled pilot from launch execution into monitored operation. It does not reopen the technical implementation, UX phase or QA/UAT closure. Its purpose is to make the live pilot observable, supportable and governable through daily evidence.

## Scope

This delivery covers:

- pilot health monitoring domains;
- support intake workflow;
- incident severity triage;
- daily health review structure;
- continue, hold, rollback and hotfix decision states;
- evidence required before feedback, defect burn-down and expansion decisions in PILOT-V5.

## Monitoring domains

The pilot health review covers availability, authentication and RBAC, Provider clinical workflows, Admin workflows, API/Python worker behavior, data and audit integrity, UX/accessibility smoke, support load and adoption evidence.

## Support model

Every support item must capture reporter, role, environment, workflow, severity, owner, expected result, actual result and evidence reference when applicable.

## Decision discipline

PILOT-V4 does not approve expansion by itself. It prepares the evidence base for PILOT-V5, where feedback, defects, adoption evidence and expansion readiness are evaluated together.
