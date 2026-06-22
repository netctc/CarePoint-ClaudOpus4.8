# PILOT-V1 - Release Gates and Rollback Control

## Release gates

| Gate | Required evidence | Decision owner |
|---|---|---|
| Gate 1 - QA closure accepted | QA-V7 closure package and audit reports present | QA/UAT owner |
| Gate 2 - Environment ready | Build, environment, secrets, migrations, backup and observability checklist reviewed | Technical owner |
| Gate 3 - Support ready | Support channel, severity rules and escalation path confirmed | Support owner |
| Gate 4 - Pilot cohort ready | Pilot users, roles and windows confirmed | Pilot owner |
| Gate 5 - Rollback ready | Rollback trigger, rollback owner and rollback path confirmed | Release owner |
| Gate 6 - Launch approval | Go/no-go decision recorded | Release owner |

## Rollback triggers

Rollback or hold should be considered when any of the following occur:

- authentication outage for pilot users;
- data corruption or suspected data loss;
- protected role boundary failure;
- clinical workflow blocker affecting Provider users;
- API/worker failure that blocks core pilot workflows;
- unresolved P0 defect;
- repeated severe support incidents during the pilot window;
- inability to capture required audit or operational evidence.

## Decision states

- **continue** - pilot remains inside the approved scope;
- **hold** - pilot stops expansion but existing evidence is preserved;
- **rollback** - release owner triggers rollback path;
- **expand** - pilot cohort or operating window can be increased after review.
