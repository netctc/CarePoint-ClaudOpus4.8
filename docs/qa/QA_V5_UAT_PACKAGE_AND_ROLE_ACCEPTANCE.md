# QA-V5 - UAT Package and Role Acceptance

## Purpose

QA-V5 converts the prior QA planning and technical validation work into executable user acceptance testing packages. It does not modify runtime application behavior, backend contracts, Python worker logic, or database structure.

## Source baseline

- QA-V4: Node/API/Python worker E2E validation.
- UX-V6: Design refinement and UX stabilization closure.
- V64: Option B Python Progressive implementation closure.

## Role packages

| Role | Session | Priority | Acceptance focus |
| --- | --- | --- | --- |
| Admin | UAT-ADMIN-001 | P0 | Accounts, audit logs, report builder, configuration, navigation, responsive smoke. |
| Provider | UAT-PROVIDER-001 | P0 | Dashboard, queue, calendar, prescriptions, encounter notes, accessibility, responsive smoke. |
| Operator/Reviewer | UAT-OPS-001 | P1 | Audit evidence, operational review, reports/KPI evidence, supportability. |
| Platform/Technical Owner | UAT-PLATFORM-001 | P0 | Build logs, API/Python evidence, worker verification, security smoke, readiness evidence. |

## Evidence requirements

Each UAT session must capture:

- tester or stakeholder identity;
- environment and build/package identifier;
- scenario IDs executed;
- expected and actual result;
- pass/fail decision;
- screenshots or logs where applicable;
- defect references for deviations;
- acceptance decision and approval reference.

## Acceptance gates

QA-V5 is complete when:

- all role packages are present;
- Admin and Provider UAT packages include P0 acceptance criteria;
- Platform/Technical Owner package references build/API/Python evidence;
- defect severity gates are documented;
- UAT evidence templates are available;
- QA-V1 through QA-V4 remain complete.

## Next step

After QA-V5, proceed to QA-V6 for production readiness and go-live checklist validation.
