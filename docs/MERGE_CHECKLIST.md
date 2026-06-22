# Phase 30 Merge Checklist

## Before merge

- [ ] Confirm current branch is clean: `git status`
- [ ] Create a branch: `git checkout -b phase30-account-mutation-audit-hardening`
- [ ] Confirm no `.env` files are copied from this package
- [ ] Confirm Phase 29 account list pagination is already merged or accounted for
- [ ] Locate current admin accounts routes/controllers/services
- [ ] Locate current admin account page/dialog components

## Backend merge

- [ ] Copy or merge `services/api/src/lib/account-mutation-policy.ts`
- [ ] Copy or merge `services/api/src/lib/account-mutation-audit.ts`
- [ ] Copy or merge `services/api/src/modules/admin/accounts.validation.phase30.ts`
- [ ] Compare `accounts.routes.phase30.example.ts` with the current account route
- [ ] Preserve existing auth middleware names and import paths
- [ ] Preserve current Prisma model names if they differ from the example
- [ ] Preserve organization scoping for company admins
- [ ] Confirm self-deactivate/self-delete protection
- [ ] Confirm non-super-admin users cannot grant super-admin permissions
- [ ] Confirm audit events are emitted for successful mutations

## Frontend merge

- [ ] Copy or merge `apps/admin/src/lib/account-mutations.ts`
- [ ] Use `AccountMutationDrawer.example.tsx` as a component reference
- [ ] Use `AccountStatusBadge.example.tsx` as a small display helper if useful
- [ ] Refresh the Phase 29 paged account query after a successful mutation
- [ ] Show clear API validation errors in the UI
- [ ] Require confirmation before deactivate/delete actions

## Verification

- [ ] `npm run prisma:generate --workspace @care-center/api`
- [ ] `npm run build --workspace @care-center/api`
- [ ] `npm run build --workspace @care-center/admin`
- [ ] Create a test account
- [ ] Edit a test account
- [ ] Deactivate/reactivate a test account
- [ ] Try to deactivate your own admin account and confirm it is blocked
- [ ] Try cross-organization mutation as company admin and confirm it is blocked
- [ ] Check audit logs or API logs for account mutation events
