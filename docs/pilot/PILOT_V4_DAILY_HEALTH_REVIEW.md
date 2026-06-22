# PILOT-V4 - Daily Health Review

## Daily review objective

The daily health review determines whether the controlled pilot should continue, hold, enter a hotfix window, rollback or prepare for expansion evaluation.

## Required sections

1. Pilot status.
2. Cohort access.
3. Admin workflow health.
4. Provider workflow health.
5. API/Python health.
6. Incident register.
7. P0/P1 aging.
8. Data and audit integrity.
9. User feedback.
10. Adoption evidence.
11. Risks and mitigations.
12. Next 24-hour action plan.

## Expected daily output

Each review should produce a concise decision record:

- date and environment;
- reviewers and owners;
- current decision state;
- P0/P1/P2 counts;
- blocker summary;
- evidence references;
- next action owner and due date.

## Accepted decision states

- `green`: continue pilot.
- `yellow`: continue with monitoring or workaround.
- `red-hold`: pause access or expansion.
- `rollback`: revert according to approved rollback path.
- `hotfix-window`: controlled correction required before normal continuation.
