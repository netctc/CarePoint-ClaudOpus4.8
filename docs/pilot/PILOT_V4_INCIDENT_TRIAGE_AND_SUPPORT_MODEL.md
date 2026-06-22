# PILOT-V4 - Incident Triage and Support Model

## Severity model

### P0

Blocks pilot operation, creates data integrity risk, exposes role-boundary failure, or prevents critical Provider/Admin workflow execution. P0 requires immediate owner assignment and continue/hold/rollback decision.

### P1

Material pilot impact with workaround or limited scope. P1 must be triaged the same day and cannot remain unowned in the daily health review.

### P2

Non-critical usability issue, documentation gap, training clarification or workflow improvement. P2 items feed PILOT-V5 defect burn-down and feedback review.

### P3

Enhancement request or post-close improvement candidate. P3 items are tracked separately from go-live blockers.

## Support workflow

1. Intake.
2. Severity classification.
3. Owner assignment.
4. Reproduction or verification.
5. Technical diagnosis.
6. Pilot decision.
7. Resolution evidence.
8. Daily rollup.

## Required incident fields

- incident ID;
- reporter;
- role;
- workflow;
- environment;
- severity;
- owner;
- current state;
- evidence reference;
- target update time;
- final disposition.
