# Admin Accounts CRUD Phase 11 — Governance Reporting / Export Pack

## Scope
This phase extends the existing patient/provider account-management and provider credentialing workflow with operational reporting. It is designed for administrators, compliance managers, and operational supervisors who need a summarized view of account lifecycle, provider onboarding, credential risk, review task backlog, and credential notification performance.

## Backend additions

### New API endpoints

- `GET /api/admin/users/governance-summary`
  - Returns an aggregated governance summary for the current admin scope.
  - Organization-scoped admins receive organization-only metrics.
  - Super Admins receive global metrics.

- `GET /api/admin/users/governance-report/export?type=SUMMARY|CREDENTIALS|TASKS|NOTIFICATIONS`
  - Returns CSV reports for governance review.
  - Supported report types:
    - `SUMMARY`: account lifecycle, onboarding, credential, task, and notification counts.
    - `CREDENTIALS`: provider credential document status, expiry, and verification report.
    - `TASKS`: provider credential review task queue and overdue report.
    - `NOTIFICATIONS`: credential reminder/dispatch audit report.

### Metrics included

- Patient and provider totals by lifecycle status.
- Provider onboarding status distribution.
- Credential document status and document type distribution.
- Credential expiry risk: expired and expiring-soon documents.
- Credential review tasks by status and priority.
- Active and overdue credential review tasks.
- Credential notifications by status and channel.
- Failed and queued notification risk indicators.
- Recent account/credential audit events.

## Admin UI additions

### `/portal/accounts`

Added a new **Account governance reporting** panel with:

- Managed account totals.
- Lifecycle status summaries.
- Provider onboarding readiness indicators.
- Credential expiry risk cards.
- Review workflow backlog indicators.
- Notification queue/failed dispatch metrics.
- Risk preview lists for:
  - expired credentials,
  - credentials expiring soon,
  - overdue credential review tasks,
  - failed reminders.

### Admin CSV proxy routes

Because API downloads require the admin bearer token, this phase adds server-side proxy routes:

- `/portal/accounts/export`
  - Proxies existing patient/provider account exports.

- `/portal/accounts/governance-export`
  - Proxies the new governance report exports.

## Files changed

- `services/api/src/modules/admin-users/admin-users.routes.ts`
- `apps/admin/src/app/portal/accounts/page.tsx`
- `apps/admin/src/app/portal/accounts/export/route.ts`
- `apps/admin/src/app/portal/accounts/governance-export/route.ts`
- `apps/admin/src/app/globals.css`

## Database impact

No new tables or columns are required in this phase. The reporting endpoints read from the tables already added in previous phases:

- `User`
- `PatientProfile`
- `ProviderProfile`
- `ProviderOnboardingState`
- `ProviderCredentialDocument`
- `ProviderCredentialReviewTask`
- `ProviderCredentialNotification`
- `AuditLog`

## Environment variables

No `.env` file is included.

No new required environment variables are introduced. The Admin proxy routes reuse the existing `NEXT_PUBLIC_API_BASE_URL` already used by the Admin application.

## Validation performed

- TypeScript/TSX transpile syntax checks were run for modified backend and Admin files.
- Full build was not run because dependencies are not installed in the extracted workspace.

## Recommended next phase

Phase 12 should add scheduled governance automation:

- daily generation of governance snapshots,
- weekly compliance digest,
- automatic queuing of reminders for credentials expiring in 30 days,
- alert thresholds for overdue credentialing tasks.
