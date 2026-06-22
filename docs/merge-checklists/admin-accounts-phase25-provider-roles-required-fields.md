# Phase 25 merge checklist - Provider role maintenance and safer account forms

## Database
- [ ] Apply migration `20260429120000_provider_role_catalog`.
- [ ] Run `npm run prisma:generate --workspace @care-center/api`.
- [ ] Confirm default provider roles exist: `PROVIDER`, `NURSE`, `PHARMACIST`, `LAB_TECH`.
- [ ] Confirm existing provider profiles have `roleCatalogId` backfilled where possible.

## API
- [ ] Restart the API service.
- [ ] Verify `GET /api/admin/users/provider-roles` returns role catalog records.
- [ ] Create a custom provider role and confirm duplicate role codes are blocked.
- [ ] Update a custom provider role.
- [ ] Delete an unused custom provider role.
- [ ] Confirm system default roles cannot be deleted.
- [ ] Confirm custom roles used by providers cannot be deleted until providers are reassigned.

## Admin UI
- [ ] Open `/portal/accounts`.
- [ ] Confirm the Provider role catalog panel is visible.
- [ ] Confirm required fields are visibly marked with `*` in create/edit patient and provider forms.
- [ ] Confirm provider creation role list uses the maintainable role catalog.
- [ ] Confirm provider edit role list uses the maintainable role catalog.
- [ ] Test create/update/delete error paths and verify errors are shown as in-page messages instead of runtime overlays.

## Regression
- [ ] Create patient.
- [ ] Update patient.
- [ ] Delete an unprotected test patient.
- [ ] Create provider with a default role.
- [ ] Create provider with a custom role.
- [ ] Update provider role assignment.
- [ ] Delete an unprotected test provider.
