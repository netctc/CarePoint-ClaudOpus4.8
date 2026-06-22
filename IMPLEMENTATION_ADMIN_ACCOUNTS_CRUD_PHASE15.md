# Admin Accounts CRUD Phase 15 — Account Audit Drill-Down Fix

## Objective

Phase 15 improves the audit-log experience after the route fix in Phase 14. The audit page now supports account-specific and resource-specific evidence filtering, and the Admin account-management page links directly to the correct audit evidence for patients, providers, and provider credential documents.

## What changed

### Admin UI

Updated `apps/admin/src/app/portal/accounts/page.tsx`:

- Added account audit links from patient rows.
- Added provider audit links for:
  - account-only lifecycle evidence
  - full provider credentialing evidence
- Added provider credential document audit links from each credential document row.
- Added URL builders for scoped audit links:
  - `accountAuditHref(...)`
  - `resourceAuditHref(...)`

Updated `apps/admin/src/app/portal/audit/logs/page.tsx`:

- The page now supports these query parameters:
  - `accountType=PATIENT|PROVIDER`
  - `accountId=<profileId>`
  - `includeRelated=true|false`
  - `resource=<auditResource>`
  - `resourceId=<resourceId>`
  - `action=<partialAction>`
  - `limit=<1-200>`
- Added an Audit Filters panel.
- Added scoped evidence summary in the hero section.
- Added filtered account-governance API loading through `/api/admin/users/audit`.
- Keeps the existing integrated audit behavior when no filters are supplied.

### Backend API

Updated `services/api/src/modules/admin-users/admin-users.routes.ts`:

- Enhanced `GET /api/admin/users/audit` to support:
  - account type filtering
  - account ID filtering
  - resource/resourceId filtering
  - action substring filtering
  - provider related evidence lookup
  - response scope metadata
- Provider account audit can now include related credential evidence from:
  - `provider_credential_document`
  - `provider_credential_review_task`
  - `provider_credential_notification`

## Example URLs

```text
/portal/audit/logs?accountType=PATIENT&accountId=<patientProfileId>&includeRelated=false&limit=100
/portal/audit/logs?accountType=PROVIDER&accountId=<providerProfileId>&includeRelated=true&limit=100
/portal/audit/logs?resource=provider_credential_document&resourceId=<documentId>&accountType=PROVIDER&accountId=<providerProfileId>&limit=100
```

## API examples

```http
GET /api/admin/users/audit?type=PROVIDER&id=<providerProfileId>&includeRelated=true&limit=100
Authorization: Bearer <admin-token>

GET /api/admin/users/audit?resource=provider_credential_document&resourceId=<documentId>&limit=100
Authorization: Bearer <admin-token>
```

## Expected behavior

- Clicking **Audit trail** on a patient row opens the audit page filtered to that patient profile.
- Clicking **Account audit** on a provider row opens provider profile lifecycle evidence only.
- Clicking **Full credential audit** on a provider row opens provider profile evidence plus related credential document, review task, and credential reminder evidence.
- Clicking **Document audit trail** on a credential document opens audit evidence for that credential document.

## Environment variables

No `.env` file is included.

No new required environment variables were added.

## Validation notes

A full workspace build was not executed because the uploaded implementation package does not include installed dependencies. The patch is limited to server route filtering and Admin server-component navigation/rendering changes.
