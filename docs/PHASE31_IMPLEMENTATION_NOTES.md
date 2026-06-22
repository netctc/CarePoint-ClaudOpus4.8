# Phase 31 Implementation Notes

## Functional behavior

Phase 31 introduces account administration workflows that normally create operational risk if implemented without guardrails:

1. Bulk lifecycle updates.
2. CSV import preview.
3. CSV import commit.
4. CSV export.
5. Bulk job traceability.

## Bulk lifecycle rules

Supported actions:

- `DEACTIVATE`
- `REACTIVATE`
- `LOCK`
- `UNLOCK`

Each request must include:

- Account IDs, max 500 per request.
- Operation.
- Audit reason, minimum 8 characters.
- Optional facility scope.

Each affected account receives an account-level audit event. Each job also receives a job-level audit event.

## CSV import rules

Required columns:

- `email`
- `displayName`
- `role`

Optional columns:

- `facilityCode`
- `phone`
- `externalReference`

The preview endpoint returns row-level issues and refuses commit until all validation issues are resolved.

## Security controls

- All endpoints must sit behind Admin-only middleware.
- Organization scope must come from the authenticated session, never from request body.
- Facility scope must be validated against the authenticated admin permissions before commit.
- Bulk operations should be rate-limited at the gateway or API middleware layer.
- Audit reasons must be preserved and visible in audit log screens.

## Data model note

The SQL migration creates `AccountBulkJob`. If your Prisma schema does not have an `Account` model and uses `User` instead, keep the job table but adapt the service model aliases.

## Expected QA outcome

- A CSV with duplicate email values is rejected at preview stage.
- A CSV with invalid email is rejected at preview stage.
- A valid CSV can create new accounts in a scoped organization.
- Existing non-deleted accounts can be updated by CSV commit.
- Deleted accounts are not silently restored.
- Bulk deactivate/reactivate creates audit entries.
- Export returns stable CSV headers.
