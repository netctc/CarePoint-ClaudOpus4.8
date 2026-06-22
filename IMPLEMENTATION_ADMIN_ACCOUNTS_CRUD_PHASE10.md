# Admin Accounts CRUD Phase 10 — Credential Notification Dispatch Adapter

## Scope
Phase 10 turns the Phase 9 credential notification queue into an operational dispatch workflow. It keeps the queue auditable while adding backend dispatch endpoints, delivery metadata, a worker entrypoint, and Admin UI controls.

## Added backend capability

### Prisma model extension
`ProviderCredentialNotification` now stores dispatch metadata:

- `deliveryProvider`
- `deliveryProviderMessageId`
- `dispatchAttemptCount`
- `lastDispatchAt`

Migration added:

- `services/api/prisma/migrations/20260428113000_provider_credential_notification_dispatch/migration.sql`

### Dispatch service
New file:

- `services/api/src/lib/provider-credential-notification-dispatcher.ts`

Responsibilities:

- Finds due `QUEUED` credential notifications.
- Skips `MANUAL` channel reminders by default.
- Marks `IN_APP` reminders as sent internally.
- Supports dry-run dispatch by default.
- Supports a generic webhook provider for real external delivery.
- Records dispatch attempts in notification metadata.
- Updates notification lifecycle fields.
- Writes audit events for success/failure.

### New API endpoints

- `GET /api/admin/users/credential-notifications/dispatch-config`
- `POST /api/admin/users/credential-notifications/dispatch`
- `POST /api/admin/users/credential-notifications/:notificationId/dispatch`

### Worker entrypoint
New file:

- `services/api/src/workers/dispatch-provider-credential-notifications.ts`

New package script:

```bash
npm run credential-notifications:dispatch --workspace @care-center/api
```

Optional CLI arguments:

```bash
npm run credential-notifications:dispatch --workspace @care-center/api -- --limit=50 --force=true
```

## Admin UI additions
File updated:

- `apps/admin/src/app/portal/accounts/page.tsx`

Added:

- Dispatch due reminders batch action.
- Per-notification `Dispatch now` / `Retry dispatch` action.
- Dispatch metadata display:
  - provider adapter
  - provider message reference
  - attempt count
  - last attempt date

## Optional environment variables
No `.env` file is included. Add these manually only when you want real external delivery.

### Dry-run mode, default enabled
```bash
PROVIDER_CREDENTIAL_NOTIFICATION_DRY_RUN=true
```

When dry-run is enabled, EMAIL reminders are marked as sent without calling an external provider. This is useful for validating the workflow.

### Real webhook dispatch
```bash
PROVIDER_CREDENTIAL_NOTIFICATION_DRY_RUN=false
PROVIDER_CREDENTIAL_NOTIFICATION_PROVIDER=webhook
PROVIDER_CREDENTIAL_NOTIFICATION_WEBHOOK_URL=https://your-delivery-adapter.example.com/send
PROVIDER_CREDENTIAL_NOTIFICATION_WEBHOOK_TOKEN=replace-with-token
PROVIDER_CREDENTIAL_NOTIFICATION_FROM=noreply@carecenter.local
```

The webhook receives a JSON payload containing provider, organization, document, task, recipient, subject, and message details.

## Recommended operational setup

1. Apply Prisma migration.
2. Generate Prisma client.
3. Deploy API and Admin patch.
4. Test from Admin UI with dry-run mode.
5. Configure webhook provider manually when ready.
6. Add a cron/scheduler command, for example every 5 minutes:

```bash
npm run credential-notifications:dispatch --workspace @care-center/api -- --limit=50
```

## Audit events

- `admin.provider.credential_notification.dispatched`
- `admin.provider.credential_notification.dispatch_failed`

## Validation performed

- TypeScript/TSX transpile syntax checks passed for:
  - dispatcher service
  - worker entrypoint
  - admin-users route
  - Admin accounts page

Full build validation was not run because project dependencies are not installed in the extracted workspace.
