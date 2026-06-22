# CarePoint Admin Accounts CRUD Phase 12 — Operational Data Quality & QA Readiness

## Objective

Phase 12 adds an operational data-quality layer to the Admin Patient & Provider Accounts workspace. The goal is to help administrators, compliance teams, and implementation analysts detect account-governance problems before they become production incidents.

This phase builds on the previous account CRUD, lifecycle, credentialing, reminder, dispatch, and governance reporting phases.

## Added backend capabilities

### New API endpoints

#### `GET /api/admin/users/data-quality`
Returns a scoped data-quality report for the current admin:

- Super Admin: global account-governance scope.
- Organization-scoped admins: current organization only.

The response includes:

- issue counts by severity: `BLOCKER`, `WARNING`, `INFO`
- records scanned by category
- detailed issue list with:
  - severity
  - category
  - entity type
  - entity ID
  - organization name
  - account name/email
  - issue title
  - issue detail
  - recommended action

#### `GET /api/admin/users/data-quality/export`
Exports the same issue list as CSV for operational follow-up.

### Data-quality checks implemented

Patient checks:

- inactive patient without deactivation reason
- missing date of birth
- missing insurance number

Provider checks:

- inactive provider without deactivation reason
- active provider not approved in credentialing lifecycle
- active provider missing verified required credentials
- missing specialty
- missing license number
- missing service scope

Credential document checks:

- expired credential document
- credential document expiring soon

Review task checks:

- overdue active credential review tasks
- high/urgent overdue tasks are treated as blockers

Notification checks:

- failed credential reminders
- queued reminders whose scheduled time has passed

## Added Admin UI capabilities

The `/portal/accounts` page now includes an **Operational data quality** panel with:

- blocker/warning/info counters
- latest scoped scan timestamp
- first 12 visible issues
- recommended action for each issue
- CSV export button for the full data-quality issue list

## Added Admin proxy route

### `/portal/accounts/data-quality-export`
Secure server-side proxy route that downloads the backend CSV using the admin auth token stored in cookies.

## Files changed or added

```text
services/api/src/modules/admin-users/admin-users.routes.ts
apps/admin/src/app/portal/accounts/page.tsx
apps/admin/src/app/portal/accounts/data-quality-export/route.ts
apps/admin/src/app/globals.css
IMPLEMENTATION_ADMIN_ACCOUNTS_CRUD_PHASE12.md
```

## Validation performed

Syntax/transpile validation was performed using TypeScript transpilation diagnostics for:

- `services/api/src/modules/admin-users/admin-users.routes.ts`
- `apps/admin/src/app/portal/accounts/page.tsx`
- `apps/admin/src/app/portal/accounts/data-quality-export/route.ts`

No parse/transpile errors were detected in the modified files.

## Environment variables

No `.env` file is included.

No new required environment variables were added.

## Merge notes

1. Apply the patch files over the current Phase 11 workspace.
2. Run Prisma generation if your workspace has not already generated the Phase 7–11 models:

```bash
npm run prisma:generate --workspace @care-center/api
```

3. Start the API and Admin app:

```bash
npm run dev --workspace @care-center/api
npm run dev --workspace @care-center/admin
```

4. Open:

```text
http://localhost:3001/portal/accounts
```

5. Verify the new panel:

- Operational data-quality counters are visible.
- CSV export downloads from `/portal/accounts/data-quality-export`.
- Scoped admins only see issues for their organization.
- Super Admins see global data-quality issues.

## Recommended next phase

Phase 13 should add remediation workflows for data-quality findings, such as:

- direct “create reminder” action from an issue
- direct “assign review task” action from an issue
- one-click “add missing deactivation reason” prompt
- issue dismissal / acknowledgement tracking
- compliance dashboard roll-up outside the accounts page
