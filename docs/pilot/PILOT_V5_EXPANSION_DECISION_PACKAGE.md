# PILOT-V5 - Expansion Decision Package

## Decision options

The expansion decision must choose one explicit outcome:

1. `expand` - proceed to a broader pilot or go-live execution path.
2. `continue-limited-pilot` - keep the current scope while collecting more evidence.
3. `hold-expansion` - stop expansion until blockers are resolved.
4. `hotfix-and-retest` - apply a targeted correction and rerun focused validation.
5. `rollback` - revert according to the approved rollback path.

## Minimum gates before expansion

- No open P0 defects.
- No unowned P1 defects.
- All open P1 defects have waiver or remediation date.
- Feedback is grouped by role and workflow.
- Adoption evidence covers Admin and Provider critical workflows.
- Support and incident triage are stable.
- Data integrity and audit visibility concerns are closed or waived.
- Rollback remains approved and current.

## Decision record template

Required fields:

- decision owner;
- date;
- environment;
- cohort;
- evidence reviewed;
- open risks;
- waivers;
- next action;
- signature placeholder.

The final phase closure in PILOT-V6 should consume this decision package.
