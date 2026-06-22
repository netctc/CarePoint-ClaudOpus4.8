# QA-V5 - Defect Triage and Acceptance Gates

## Severity policy

| Severity | Production readiness impact | Required action |
| --- | --- | --- |
| P0 | Blocking | Resolve before production readiness or obtain formal owner-approved mitigation. |
| P1 | Potentially blocking | Triage before readiness signoff; proceed only with accepted mitigation or deferral. |
| P2 | Non-blocking | Move to controlled post-go-live backlog if accepted by owner. |

## Defect record requirements

Every UAT defect should include:

- defect ID;
- role and scenario ID;
- environment;
- steps to reproduce;
- expected and actual result;
- severity;
- owner;
- mitigation or target release;
- acceptance decision.

## Acceptance gates

Production readiness cannot proceed when:

- any unresolved P0 defect exists;
- Admin or Provider acceptance is missing;
- build/API/Python worker evidence is missing;
- security smoke has not been reviewed;
- deferred P1 defects have no owner or mitigation.

Production readiness can proceed when:

- all P0 sessions pass or have approved mitigation;
- Admin and Provider signoffs are recorded;
- Platform/Technical Owner confirms technical evidence;
- P1/P2 items are triaged into a controlled backlog.
