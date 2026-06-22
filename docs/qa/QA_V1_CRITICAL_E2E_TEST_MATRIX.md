# QA-V1 Critical End-to-End Test Matrix

The executable matrix is generated at:

```text
validation/qa/qa-v1-critical-e2e-test-matrix.json
```

## Coverage model

| Area | Coverage intent |
| --- | --- |
| Authentication | Admin and Provider protected access, session expiry, logout |
| Authorization | Role boundaries across Admin and Provider surfaces |
| Admin | Accounts, audit logs, report builder, delivery panels |
| Provider | Dashboard, queue, calendar, appointments, prescriptions, encounter notes |
| API | Build, validation shape, hybrid Python prepare endpoints |
| Python worker | Option B verification, contract tests, dry-run/advisory behavior |
| Cross-app E2E | Admin-to-Provider and Provider-to-Admin evidence flows |
| UX regression | Layout, navigation, component, responsive, and accessibility smoke |
| Security smoke | Secret hygiene and protected endpoint rejection |
| Production readiness | Environment, rollback, migration, backup, monitoring, and signoff |
| UAT | Stakeholder acceptance by role |

## Priority rules

- P0: Must pass before production readiness signoff.
- P1: Must pass or be formally triaged before production readiness signoff.
- P2: Should pass or be added to the approved post-readiness backlog.

## Evidence standard

Every executed scenario should capture tester, environment, date, steps, expected result, actual result, pass/fail result, and supporting screenshot/log reference where applicable.
