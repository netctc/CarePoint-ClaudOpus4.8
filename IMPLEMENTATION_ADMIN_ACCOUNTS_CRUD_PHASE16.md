# Admin Accounts CRUD Phase 16 — Audit Evidence Export & Filter Stabilization

## Objective

Phase 16 strengthens the audit-log work introduced in phases 14 and 15. The goal is to make the account audit page operationally useful for compliance reviews by adding consistent backend filtering, date and actor criteria, quick saved views, and CSV export for the currently selected evidence scope.

## Implemented changes

### Backend API

Updated file:

- `services/api/src/modules/admin-users/admin-users.routes.ts`

Added:

- Shared account-audit filter builder used by both list and export endpoints.
- Extended audit filtering by:
  - account type
  - account/profile ID
  - governance resource
  - resource ID
  - action keyword
  - actor name/email
  - created date range
  - related provider credential evidence
  - limit up to 500 records
- New CSV export endpoint:
  - `GET /api/admin/users/audit/export`
- Export audit event:
  - `admin.audit.filtered_exported`

### Admin web

Updated file:

- `apps/admin/src/app/portal/audit/logs/page.tsx`

Added:

- Actor filter.
- Date range filters.
- Export button for the current filtered evidence scope.
- Saved audit view shortcuts for common investigations:
  - patient account changes
  - provider account changes
  - credential document evidence
  - credential review tasks
  - credential reminder failures
  - deleted account evidence

New file:

- `apps/admin/src/app/portal/audit/logs/export/route.ts`

This route proxies secure CSV export requests to the API using the current admin token cookie.

### Test documentation

New file:

- `docs/api-tests/admin-accounts-phase16-audit-export.http`

## Merge notes

1. Apply phases 7 through 16 in order if starting from the original workspace.
2. Run Prisma generation after applying schema/migration changes from previous credential governance phases.
3. Run the API and Admin app locally.
4. Open `/portal/audit/logs`.
5. Verify saved views open correctly.
6. Verify `Export current evidence CSV` downloads a CSV file.
7. Verify an audit event is written for filtered export.

## Environment variables

No `.env` file is included.

No new required environment variables were added.
