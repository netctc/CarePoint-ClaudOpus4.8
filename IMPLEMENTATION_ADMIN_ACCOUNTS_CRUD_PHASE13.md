# Admin Accounts CRUD Phase 13 — Credential Governance Automation Sweep

## Objective

Phase 13 adds an operational automation layer for provider credential governance. Earlier phases allowed admins to manage providers, credential documents, review tasks, reminders, dispatch, reporting, and data-quality scans. This phase adds a controlled sweep that can be run manually from the Admin UI, through an API endpoint, or as a scheduled worker script.

The sweep helps prevent provider compliance drift by finding credential issues before they affect provider approval or clinical access.

## Added capabilities

### Backend automation service

New service:

- `services/api/src/lib/provider-credential-governance-sweeper.ts`

The sweeper scans active provider profiles and detects:

- required credential types missing a currently valid verified document
- verified credentials expiring within a configurable window
- credential documents already past expiry
- rejected credential documents that still require correction

For each issue, the sweeper can:

- mark past-expiry credential documents as `EXPIRED`
- create an active provider credential review task
- queue an email reminder notification for the provider
- skip duplicate active review tasks and duplicate queued reminders
- write a governance audit event

### API endpoint

New endpoint:

```http
POST /api/admin/users/credential-governance/sweep
```

Request body example:

```json
{
  "dryRun": false,
  "markExpired": true,
  "createReviewTasks": true,
  "queueReminders": true,
  "expiringSoonDays": 30,
  "dueInDays": 7,
  "limit": 250
}
```

The endpoint respects organization scoping:

- Company-scoped admins can only sweep their own organization.
- Super Admins may pass `organizationId` to sweep a specific organization.
- `providerId` can be passed for a targeted provider-only sweep.

### Worker script

New worker:

- `services/api/src/workers/run-provider-credential-governance-sweep.ts`

New package script:

```bash
npm run credential-governance:sweep --workspace @care-center/api
```

Optional environment variables for scheduled/manual runs:

```bash
CREDENTIAL_SWEEP_ORGANIZATION_ID=<optional organization id>
CREDENTIAL_SWEEP_DRY_RUN=true|false
CREDENTIAL_SWEEP_SKIP_MARK_EXPIRED=true|false
CREDENTIAL_SWEEP_SKIP_TASKS=true|false
CREDENTIAL_SWEEP_SKIP_REMINDERS=true|false
CREDENTIAL_SWEEP_EXPIRING_SOON_DAYS=30
CREDENTIAL_SWEEP_DUE_IN_DAYS=7
CREDENTIAL_SWEEP_LIMIT=250
```

No `.env` file is included in this deliverable. Add any optional values manually only if you want to use them.

### Admin UI

Updated page:

- `apps/admin/src/app/portal/accounts/page.tsx`

New panel:

- **Credential governance automation**

The panel allows admins to run a governed sweep from `/portal/accounts` with configurable:

- expiring-soon window
- review task due interval
- provider scan limit
- preview-only versus execute mode
- mark-expired toggle
- create-review-task toggle
- queue-reminder toggle

### Styling

Updated file:

- `apps/admin/src/app/globals.css`

Adds visual treatment for the Phase 13 automation panel.

## Idempotency and safety rules

The sweep is designed to be safe to run repeatedly:

- Existing active review tasks are reused/skipped.
- Existing queued reminders for the same task/document are skipped.
- Past-expiry credentials are only updated if they are not already `EXPIRED`.
- Dry-run mode returns candidates without writing data.

## Recommended operating model

1. Run preview mode first from Admin UI or API.
2. Review detected candidates in the returned response or audit trail.
3. Run execute mode with task creation and reminders enabled.
4. Dispatch due reminders using the Phase 10 dispatch adapter.
5. Review governance summary and data-quality panels after the run.

## Suggested schedule

For production-like environments:

- Daily sweep: detect expired and soon-expiring documents.
- Weekly management review: export governance CSV reports.
- Monthly audit: compare data-quality findings against resolved review tasks.

## Validation performed

- TypeScript/TSX syntax transpile checks were run for the new backend service, worker, updated route, and updated Admin page.
- No `.env` file is included.
- No new required environment variables were added.
