# Admin Accounts CRUD Phase 17 — Optional Organization Assignment + Organization Management

## Objective
Phase 17 implements two requested changes:

1. Patient and provider creation no longer requires the Admin user to manually select an organization.
2. Admin now has a dedicated Organization Management page where authorized users can add, modify, and delete organizations.

## Backend changes
Updated file:

- `services/api/src/modules/admin-users/admin-users.routes.ts`

### Organization optional during account creation
The existing `POST /api/admin/users/patients` and `POST /api/admin/users/providers` endpoints still persist a valid `organizationId` because the current database profile models require it. However, the API no longer rejects missing `organizationId` for unscoped/global admins.

Resolution logic:

1. If the authenticated admin is already organization-scoped, use the admin's organization.
2. If `organizationId` is supplied, validate and use it.
3. If no organization is supplied, use/create the fallback organization:
   - `Unassigned CarePoint Organization`

This keeps the UI optional while preserving referential integrity for the existing database model.

### CSV import organization optional
`POST /api/admin/users/import` now allows rows with empty `organizationId` and empty `organizationName`. Those rows are assigned to the same fallback organization.

### New organization endpoints
Added organization CRUD endpoints under the same Admin accounts module:

- `GET /api/admin/users/organizations?q=`
- `POST /api/admin/users/organizations`
- `PUT /api/admin/users/organizations/:organizationId`
- `DELETE /api/admin/users/organizations/:organizationId`

### Delete protection
Organization deletion is blocked when protected records exist, including:

- users
- patient profiles
- provider profiles
- appointments
- message threads
- audit logs
- provider onboarding states
- credential documents
- credential review tasks
- credential notifications
- service catalog / coverage / pricing / policy records
- support, safety, reports, campaigns, integrations
- clinical, RPM, facility, and patient operational records

The fallback organization is also protected in the Admin UI because it is used automatically by account creation when the organization field is empty.

### Audit events
Added audit coverage:

- `admin.organization.created`
- `admin.organization.updated`
- `admin.organization.deleted`

The account audit endpoint now accepts `resource=organization` so the Organization page audit links work correctly.

## Admin UI changes
Updated files:

- `apps/admin/src/app/portal/accounts/page.tsx`
- `apps/admin/src/app/portal/organizations/page.tsx`
- `apps/admin/src/components/layout/sidebar-nav.tsx`
- `apps/admin/src/lib/rbac/route-access.ts`

### Accounts page
- Organization selector is now optional for patient/provider creation.
- Empty organization selection displays: `Organization optional — use default/unassigned`.
- CSV import instructions were updated to explain optional organization assignment.
- Added direct link: `Manage organizations`.

### New Organizations page
New route:

- `/portal/organizations`

Capabilities:

- list organizations
- search organizations
- create organization
- modify organization name
- delete empty organizations only
- view protected dependency summary
- link to organization-related accounts
- link to organization audit trail

## No environment changes
No `.env` file is included.
No new required environment variables were added.

## Merge notes
Apply this patch after Phase 16. No Prisma migration is required in this phase because the database schema already supports `User.organizationId` as optional and the patient/provider profile tables continue receiving a valid fallback organization ID.

## Recommended validation
1. Login as Super Admin.
2. Open `/portal/organizations`.
3. Create a test organization.
4. Modify its name.
5. Delete it while it has no dependencies.
6. Create a patient from `/portal/accounts` with organization empty.
7. Create a provider from `/portal/accounts` with organization empty.
8. Confirm both accounts are assigned to `Unassigned CarePoint Organization`.
9. Confirm `/portal/audit/logs?resource=organization` loads organization audit records.
10. Confirm deletion is blocked for organizations with linked accounts or operational records.
