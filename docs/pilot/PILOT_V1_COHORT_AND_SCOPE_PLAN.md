# PILOT-V1 - Cohort and Scope Plan

## Recommended pilot scope

Use a controlled cohort before broad production exposure.

| Scope area | Recommended starting position | Evidence required |
|---|---|---|
| Users | 1-3 Admin users and 2-5 Provider users | Named cohort list or role-based cohort list. |
| Roles | Admin, Provider, Operator/Reviewer, Platform owner | Role acceptance mapped from QA-V5. |
| Workflows | Login, dashboard, queue, calendar, prescriptions, encounter notes, reports, audit evidence | Scenario IDs mapped from QA-V1 to QA-V7. |
| Time window | 1 controlled launch window, then daily review | Start/end timestamp and support owner. |
| Data | Non-production data or approved pilot data | Data approval and rollback impact note. |
| Support | Live issue intake during launch window | Support channel, owner, and severity rules. |

## Cohort acceptance gates

- All pilot users have assigned roles.
- Each role has at least one acceptance scenario.
- Support and release owners are available during launch.
- Rollback criteria are understood by all owners.
- Open P0 defects are zero before pilot start.

## Evidence capture

Each pilot session should capture:

- tester/user;
- role;
- environment;
- scenario IDs;
- steps executed;
- actual result;
- pass/fail;
- defect reference, if applicable;
- screenshot/log reference, if applicable;
- decision: continue, hold, rollback, or expand.
