# QA-V6 - Environment, Deployment, Backup, and Rollback

## Environment review

Confirm the target environment before promotion:

- environment name;
- base URLs for Admin, Provider, API, and Python worker when applicable;
- database target;
- configuration owner;
- release package and SHA-256.

## Deployment readiness

The deployment owner should confirm:

- dependency installation procedure;
- build commands;
- migration command and rollback expectation;
- release package archival;
- operational contact path.

## Backup and recovery

Before go-live or pilot:

- capture pre-release backup or recovery point;
- document restore owner;
- document restore verification method;
- confirm rollback trigger criteria.

## Rollback triggers

Rollback or no-go should be considered when:

- API build fails in the target environment;
- protected API or route security smoke fails;
- Python worker verification fails;
- a P0 UAT defect remains unresolved;
- data migration/backup validation is incomplete;
- monitoring or support owner is not assigned.
