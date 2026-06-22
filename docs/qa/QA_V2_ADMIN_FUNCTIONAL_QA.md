# QA-V2 - Admin Functional QA

## Purpose

QA-V2 converts the QA-V1 master plan into Admin-specific functional validation coverage.

This delivery focuses on readiness for manual QA, E2E automation candidates, and signoff evidence across Admin surfaces.

## Scope

Admin validation covers:

- authentication and Admin portal access;
- role-based access control;
- accounts list and account management;
- account export and governance export routes;
- audit logs;
- report builder;
- organizations;
- providers and onboarding;
- integration settings;
- support console;
- safety incidents;
- configuration and environment readiness.

## Non-goals

QA-V2 does not change:

- backend contracts;
- Python worker behavior;
- database schema;
- application runtime logic;
- UX phase closure artifacts.

## Evidence expected

Each Admin QA scenario should capture:

- tester;
- environment;
- date;
- Admin role used;
- steps executed;
- expected result;
- actual result;
- pass, fail, or blocked status;
- screenshot or log reference when applicable;
- defect reference when failed.

## Generated validation artifacts

- `validation/qa/qa-v2-admin-functional-config-audit.json`
- `validation/qa/qa-v2-admin-functional-test-plan.json`

## Exit criteria

QA-V2 is ready for QA execution when:

- all Admin critical surfaces are present;
- QA scripts are registered;
- configuration artifacts exist;
- QA-V1 continuity checks remain valid;
- Admin test plan contains P0 coverage for authentication, authorization, accounts, audit, reports, RBAC, configuration, and readiness.
