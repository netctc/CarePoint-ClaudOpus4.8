# Admin Accounts CRUD Phase 9 — Credential Reminder / Notification Queue

## Scope
This phase extends the Admin Patient & Provider Accounts workspace with an auditable notification/reminder layer for provider credential governance. It does **not** send email directly; it queues reminder records that can later be consumed by an SMTP/SMS/notification worker.

## Added Backend Capabilities

### New Prisma enums
- `ProviderCredentialNotificationChannel`
  - `EMAIL`
  - `IN_APP`
  - `MANUAL`
- `ProviderCredentialNotificationStatus`
  - `QUEUED`
  - `SENT`
  - `FAILED`
  - `CANCELLED`

### New Prisma model
- `ProviderCredentialNotification`

This model stores:
- Organization scope
- Provider reference
- Optional credential document reference
- Optional credential review task reference
- Notification channel and lifecycle status
- Subject and message
- Recipient email
- Scheduled date
- Sent/failure metadata
- Created-by user
- Audit-friendly timestamps

### New migration
- `services/api/prisma/migrations/20260428110000_provider_credential_notifications/migration.sql`

### New API endpoints
- `GET /api/admin/users/credential-notifications`
  - Lists queued/sent/failed/cancelled credential reminders.
  - Supports filters: `status`, `providerId`, `documentId`, `taskId`, `q`, `limit`.

- `POST /api/admin/users/credential-review-tasks/:taskId/reminders`
  - Queues a reminder linked to a credential review task.
  - Defaults recipient to assigned reviewer email, then provider email.

- `POST /api/admin/users/providers/:providerId/credential-reminders`
  - Queues a general provider credentialing reminder or a document-specific renewal reminder.

- `PATCH /api/admin/users/credential-notifications/:notificationId/status`
  - Updates reminder status to `QUEUED`, `SENT`, `FAILED`, or `CANCELLED`.
  - Supports manual sent/failure tracking.

### Audit events
- `admin.provider.credential_notification.queued`
- `admin.provider.credential_notification.status_changed`

The audit endpoint now includes provider credential notification events.

## Added Admin UI Capabilities

### Credential notification center
The `/portal/accounts` page now shows:
- Queued reminder count
- Reminder list with provider, document, task, recipient, scheduled date, and current status
- Controls to mark reminders as sent, failed, cancelled, or queued again

### Reminder actions
Admins can now queue reminders from:
- Global credential review queue tasks
- Provider credentialing panel
- Individual credential document rows

### Notification metadata
The UI supports:
- Channel selection: `EMAIL`, `IN_APP`, `MANUAL`
- Status selection: `QUEUED`, `SENT`, `FAILED`, `CANCELLED`
- Recipient email
- Scheduled date
- Subject
- Message
- Failure reason when applicable

## Operational Notes
- This phase intentionally does not require SMTP/Twilio variables.
- A later delivery can add a background worker that reads `ProviderCredentialNotification` records where `status = QUEUED`, sends them through the configured provider, and marks them as `SENT` or `FAILED`.
- No `.env` file is included.

## Files Changed
- `services/api/prisma/schema.prisma`
- `services/api/prisma/migrations/20260428110000_provider_credential_notifications/migration.sql`
- `services/api/src/modules/admin-users/admin-users.routes.ts`
- `apps/admin/src/app/portal/accounts/page.tsx`
- `apps/admin/src/app/globals.css`

## Validation Performed
- Static TypeScript transpile checks were run against the modified backend route and Admin page.
- Full build was not run because dependencies are not installed in the extracted workspace.
