# Phase 30 Rollback Plan

Phase 30 is designed as a helper/example package with no required database migration.

## Safe rollback

1. Revert frontend imports that use `account-mutations.ts` or the example components.
2. Revert backend route changes that call the Phase 30 validation/policy/audit helpers.
3. Keep Phase 29 list performance files if they are already stable; Phase 30 does not require reverting Phase 29.
4. Restart the API and Admin apps.
5. Re-run the previous account CRUD smoke tests.

## Files to remove if fully rolling back Phase 30

- `services/api/src/lib/account-mutation-policy.ts`
- `services/api/src/lib/account-mutation-audit.ts`
- `services/api/src/modules/admin/accounts.validation.phase30.ts`
- any merged code from `accounts.routes.phase30.example.ts`
- `apps/admin/src/lib/account-mutations.ts`
- any merged code from the example account mutation components

## Data rollback

No data rollback is expected because this package does not include migrations. If you use the example hard-delete endpoint, prefer changing it to soft-delete/deactivate before production use.
