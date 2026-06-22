# Admin Accounts CRUD Phase 14 — Audit Log Route Repair

## Objective
Fix the broken Admin **Audit Logs** link by adding the missing Next.js route that the sidebar already points to: `/portal/audit/logs`.

## Added / Updated Files

- `apps/admin/src/app/portal/audit/logs/page.tsx`
  - New server-rendered Admin Audit Logs page.
  - Uses the existing `loadIntegratedAuditLogs()` server loader.
  - Uses the existing `AuditLogTable` and `AuditExportActions` components.
  - Preserves API/mock fallback behavior through `DataSourceBanner`.
  - Adds summary metrics for loaded audit events, denied/escalated outcomes, facility coverage, and family-subject events.
  - Adds navigation handoff buttons to Account Governance and Refill Governance.

- `apps/admin/src/lib/rbac/route-access.ts`
  - Included to preserve the `Patient & Provider Accounts` navigation item from the earlier account-management phase.
  - Keeps the existing `/portal/audit/logs` route visible to users with `audit:view` permission.

- `apps/admin/src/components/layout/sidebar-nav.tsx`
  - Included to preserve account-management route icon/grouping behavior.
  - The Audit Logs link now resolves because the missing page has been added.

## Result
The sidebar route:

```text
/portal/audit/logs
```

now has a corresponding page implementation and should stop returning 404 / blank route behavior.

## Validation
- TypeScript/TSX syntax transpile checks passed for:
  - `apps/admin/src/app/portal/audit/logs/page.tsx`
  - `apps/admin/src/lib/rbac/route-access.ts`
  - `apps/admin/src/components/layout/sidebar-nav.tsx`

## Notes
- No `.env` file is included.
- No new required environment variables were added.
- Full application build was not run because dependencies are not installed in this extracted patch workspace.
