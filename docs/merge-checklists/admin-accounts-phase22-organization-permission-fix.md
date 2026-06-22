# Phase 22 Merge Checklist — Organization Permission Fix

## Files

- [ ] `services/api/src/modules/admin-users/admin-users.routes.ts`
- [ ] `apps/admin/src/app/portal/organizations/page.tsx`
- [ ] `docs/api-tests/admin-accounts-phase22-organizations-permissions.http`
- [ ] `IMPLEMENTATION_ADMIN_ACCOUNTS_CRUD_PHASE22_ORGANIZATION_PERMISSION_FIX.md`

## Manual checks

- [ ] Admin organization page loads without runtime overlay.
- [ ] Create organization works for the intended Admin portal role.
- [ ] Duplicate organization name returns an in-page error.
- [ ] Update organization works.
- [ ] Delete is blocked for fallback organization.
- [ ] Delete is blocked when protected dependencies exist.
- [ ] Delete succeeds for empty non-fallback organization.
- [ ] Patient/provider account creation still allows empty organization assignment.
- [ ] Patient/provider CRUD routes were not widened to FINANCE by accident.

## Commands

```powershell
npm run dev --workspace @care-center/api
npm run dev:admin
```

Optional after dependencies are available:

```powershell
npm run build --workspace @care-center/api
npm run build --workspace @care-center/admin
```
