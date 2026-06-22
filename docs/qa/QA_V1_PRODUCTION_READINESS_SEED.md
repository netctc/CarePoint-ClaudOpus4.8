# QA-V1 Production Readiness Seed

## Readiness domains

| Domain | Checklist seed |
| --- | --- |
| Build | `npm install`, `npm run build:api`, `npm run build:web`, Python worker verification |
| Configuration | Environment variables, safe defaults, secrets out of source control |
| Database | Migration order, rollback, seed data, backup validation |
| API | Protected routes, validation errors, logging, rate/error behavior |
| Python worker | Contract tests, dry-run behavior, advisory decision auditability |
| Frontend | Admin and Provider smoke flows, responsive and accessibility smoke |
| Observability | Logs, health checks, actionable error trails, incident triage path |
| Security | RBAC, session expiry, protected endpoint rejection, audit evidence |
| Operations | Runbook, escalation path, rollback owner, go/no-go owner |
| UAT | Role signoff and exception register |

## Go/no-go seed

A release candidate should not proceed to production until all P0 scenarios pass, all P1 findings are fixed or approved, rollback is rehearsed, and UAT signoff is captured.
