# Phase 25 - Provider Role Maintenance, Required Field Markers, and Form Error Messages

## Scope
This phase improves Admin account governance in three areas requested during testing:

1. The Provider form role field is no longer a hard-coded static list. It is backed by a maintainable provider role catalog.
2. Required Patient and Provider form fields are visibly marked with `*`.
3. Create, update, and delete failures for patient/provider/role operations are redirected back to `/portal/accounts` as readable in-page error messages.

## Provider role catalog design
A new `ProviderRoleCatalog` model was added. It manages provider-facing role choices, while the existing `User.role` enum remains the security/RBAC role.

This avoids a risky dynamic RBAC enum migration while still allowing Admin users to maintain operational provider roles.

Example:

- Catalog role: `HOME_CARE_NURSE`
- Label: `Home Care Nurse`
- Mapped system role: `NURSE`

The UI displays and stores the catalog role code for provider selection. The backend maps it to the safe system role before writing `User.role`.

## Added backend endpoints

- `GET /api/admin/users/provider-roles`
- `POST /api/admin/users/provider-roles`
- `PUT /api/admin/users/provider-roles/:roleId`
- `DELETE /api/admin/users/provider-roles/:roleId`

## Database changes

Added migration:

- `services/api/prisma/migrations/20260429120000_provider_role_catalog/migration.sql`

Updated Prisma schema:

- `ProviderRoleCatalog`
- `ProviderProfile.roleCatalogId`
- relation from Provider profile to Provider role catalog

## Admin UI changes

Updated:

- `apps/admin/src/app/portal/accounts/page.tsx`

Added:

- Provider role catalog panel.
- Add provider role form.
- Update provider role form.
- Delete provider role action with safety blocking.
- Provider role selector in create provider form.
- Provider role selector in edit provider form.
- Required field marker support for AccountInput placeholders.
- In-page errors for Provider Role create/update/delete.

## Safety rules

- Default system roles cannot be deleted.
- Custom roles cannot be deleted while assigned to provider accounts.
- Inactive roles are hidden from new selections but remain visible when an existing provider currently uses them.
- The backend rejects unknown or inactive role selections.

## No environment changes
No `.env` file is included. No new required environment variables were added.
