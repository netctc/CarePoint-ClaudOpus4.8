# Phase 22 — Organization Management Permission and Runtime Error Fix

## Objective
Fix the Admin Organization Management page after the runtime error:

```text
Role is not allowed to access this resource
```

This happened when the Admin portal opened `/portal/organizations` with a role that the Admin application accepts, but the new organization routes were still protected by the broader account-governance router role list.

## Changes

### Backend
Updated:

- `services/api/src/modules/admin-users/admin-users.routes.ts`

Implemented:

- Dedicated organization route permissions.
- Organization routes now sit before the broader account CRUD router guard.
- Organization routes allow Admin portal roles including `FINANCE` for organization management.
- Patient/provider CRUD permissions remain protected by the existing broader router guard.
- Fallback organization delete protection was reinforced.
- Organization GET response now includes `canManage` so the Admin UI can disable write controls when needed.

### Admin frontend
Updated:

- `apps/admin/src/app/portal/organizations/page.tsx`

Implemented:

- Safer API error parsing.
- Raw JSON API errors are converted into readable messages.
- Server actions no longer crash the Next.js runtime overlay when the API rejects create/update/delete.
- Success and error messages are shown inside the page.
- Create/edit/delete controls respect the backend `canManage` flag.

## No environment changes
No `.env` file is included and no new required environment variables were added.

## Validation steps

1. Apply this patch over the workspace.
2. Restart the API and Admin app.
3. Open:
   - `http://localhost:3001/portal/organizations`
4. Test:
   - create organization
   - modify organization name
   - delete an empty non-fallback organization
   - attempt duplicate organization name
   - attempt deleting protected/fallback organization
5. Confirm errors display inside the page instead of the Next.js runtime overlay.

## Notes
This phase intentionally focuses only on the organization-management permission/runtime error. It does not change Provider web login or logout code.
