# Admin Accounts CRUD Phase 4 — Bulk Lifecycle and Audit Visibility

## Scope
This phase extends the Patient & Provider Accounts implementation with operational controls required by administrators after the basic create/modify/delete and lifecycle work:

- Bulk lifecycle changes for selected patient or provider accounts.
- Fast per-account lifecycle actions: reactivate, suspend, archive.
- Account audit history visible from the Admin portal.
- Audit action names that distinguish reactivation/restoration from suspension/archive.
- UI hardening for dependency-protected deletes and bulk lifecycle operations.

## Backend changes
Updated file:

- `services/api/src/modules/admin-users/admin-users.routes.ts`

### New API endpoints

#### `GET /api/admin/users/audit?limit=30&type=PATIENT|PROVIDER&id=<profileId>`
Returns recent account-management audit events.

Behavior:
- Company-scoped admins only see events inside their organization.
- Without `type`, returns account events for both `patient_profile` and `provider_profile`.
- With `type`, narrows to patient or provider account events.
- With `id`, narrows to a single profile resource.

#### `POST /api/admin/users/bulk-status`
Bulk-updates the lifecycle status for selected accounts.

Payload:

```json
{
  "type": "PATIENT",
  "ids": ["profile_id_1", "profile_id_2"],
  "status": "SUSPENDED",
  "deactivationReason": "Administrative review"
}
```

Behavior:
- Supports `PATIENT` and `PROVIDER` types.
- Supports statuses `ACTIVE`, `SUSPENDED`, and `ARCHIVED`.
- Caps each bulk operation at 100 selected accounts.
- Reactivation clears deactivation metadata.
- Suspension/archive revokes active refresh sessions.
- Writes one audit event per affected account.
- Returns updated account objects and skipped count for accounts outside scope.

### Audit action improvements
The lifecycle audit log now uses specific action names:

- `admin.patient.restored`
- `admin.patient.suspended`
- `admin.patient.archived`
- `admin.provider.restored`
- `admin.provider.suspended`
- `admin.provider.archived`

## Admin UI changes
Updated file:

- `apps/admin/src/app/portal/accounts/page.tsx`

### Added UI functionality

- Bulk lifecycle toolbars above patient and provider lists.
- Row checkboxes for bulk patient/provider status changes.
- Quick lifecycle action buttons on each account row:
  - Reactivate
  - Suspend
  - Archive
- Account audit history panel showing recent account actions.
- Updated hero metrics and policy copy to include audit and bulk lifecycle controls.
- Existing create, edit, password reset, status edit, and protected-delete behavior remains intact.

## Styling changes
Updated file:

- `apps/admin/src/app/globals.css`

Added styles for:

- Bulk lifecycle toolbar.
- Row selectors.
- Account side panel.
- Quick status action buttons.
- Account audit timeline.
- Disabled button state.
- Responsive layout for account rows and bulk controls.

## Operational notes

- No `.env` file is included.
- No new environment variables are required.
- The Phase 3 migration for `AccountStatus`, `deactivatedAt`, and `deactivationReason` is still required before Phase 4 endpoints can run against the database.
- Full build validation was not run in this package because dependencies are not installed in the extracted workspace.

## Recommended validation after applying

From the project root after installing dependencies:

```bash
npm install
npm run prisma:generate --workspace @care-center/api
npm run build --workspace @care-center/api
npm run build --workspace @care-center/admin
```

Manual QA:

1. Sign in to the Admin portal.
2. Open `/portal/accounts`.
3. Create a test patient and provider.
4. Suspend one account using the quick action.
5. Confirm sign-in is blocked for that suspended account.
6. Reactivate the same account.
7. Confirm deactivation metadata is cleared.
8. Select multiple rows and apply a bulk archive/suspend/reactivate action.
9. Verify audit events appear in the Account audit history panel.
10. Confirm delete is still blocked for accounts with protected downstream dependencies.
