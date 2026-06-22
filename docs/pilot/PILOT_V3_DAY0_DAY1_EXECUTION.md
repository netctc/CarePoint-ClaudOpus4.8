# PILOT-V3 — Day-0 / Day-1 Execution

## Day-0 execution

| Step | Owner | Action | Decision |
|---:|---|---|---|
| 1 | Release owner | Confirm selected release package, checksum and staging target. | continue or hold |
| 2 | Technical owner | Confirm environment variables, secrets, backup, migration and rollback status. | continue or hold |
| 3 | QA/UAT owner | Run launch gate audit and confirm QA/Pilot evidence is present. | continue or hold |
| 4 | Release owner | Activate the pilot release in the controlled target environment. | continue or rollback |
| 5 | QA/UAT owner | Execute Admin smoke: login, route, account/configuration, audit. | continue, hold or rollback |
| 6 | QA/UAT owner | Execute Provider smoke: login, dashboard, queue, calendar and clinical form. | continue, hold or rollback |
| 7 | Technical owner | Execute API/Python smoke and worker verification path. | continue, hold or rollback |
| 8 | Support owner | Open command center and confirm support coverage. | continue or hold |
| 9 | Pilot owner | Enable pilot cohort access and send launch communication. | continue, hold or rollback |
| 10 | Pilot owner | Record day-0 status and decision. | continue, hold, rollback or retry |

## Day-1 execution

| Step | Owner | Action | Evidence |
|---:|---|---|---|
| 1 | Support owner | Review early support events, access issues and P0/P1 defects. | health snapshot |
| 2 | Pilot owner | Confirm cohort can execute expected workflows. | activity notes |
| 3 | QA/UAT owner | Triage defects by severity, owner and pilot impact. | triage log |
| 4 | Technical owner | Review logs, API/Python behavior and data handling evidence. | technical health notes |
| 5 | Pilot owner | Collect feedback from Admin, Provider and Operator/Reviewer. | feedback summary |
| 6 | Pilot owner | Record daily pilot decision. | signed decision record |

## Day-1 decision options

```text
continue
hold
rollback
hotfix-required
prepare-expansion
```

PILOT-V4 consumes the day-0/day-1 records and turns them into monitoring, support and incident triage operations.
