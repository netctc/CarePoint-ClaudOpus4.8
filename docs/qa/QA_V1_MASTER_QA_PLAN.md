# QA-V1 Master QA Plan

## Phase
CarePoint Phase 3 - End-to-End QA, UAT & Production Readiness.

## Baseline
This phase starts after two closed phases:

- Option B Python Progressive Implementation closed at V64.
- Design Refinement & UX Stabilization closed at UX-V6.

QA-V1 does not reopen backend contracts, Python worker implementation, database schema, or UX implementation. It establishes the QA execution framework for the next deliveries.

## Objectives

1. Define the master QA scope for CarePoint.
2. Establish critical end-to-end test coverage.
3. Prepare UAT evidence capture by role.
4. Seed the production readiness checklist.
5. Provide automated source-level validation that the required QA artifacts are present.

## QA tracks

| Track | Purpose | Initial status |
| --- | --- | --- |
| Functional QA | Validate Admin and Provider flows | Planned |
| End-to-end QA | Validate cross-app and API/Python worker flows | Planned |
| Regression QA | Protect V64 and UX-V6 closure scope | Planned |
| UAT | Capture stakeholder acceptance | Planned |
| Production readiness | Validate deployment, rollback, monitoring, and support readiness | Planned |

## Entry criteria

- V64 final technical package exists.
- UX-V6 final design package exists.
- `npm install` and `npm run build:api` have passed in the target environment.
- QA-V1 audit passes.

## Exit criteria for QA-V1

- Master QA plan exists.
- Critical E2E matrix exists.
- UAT readiness package exists.
- Production readiness seed exists.
- `npm run audit:qa` passes.

## Next delivery
QA-V2 should execute Admin functional QA and configuration validation.
