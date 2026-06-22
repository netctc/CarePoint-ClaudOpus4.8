# Phase 32 Rollback Plan

## Backend rollback

1. Remove the import for `listRefillOperationalEvents` from `records.routes.ts`.
2. Restore the previous route body.
3. Remove `services/api/src/modules/records/refillOperationalEvents.ts` only if no other route imports it.

## Admin route rollback

1. Remove the added `/portal/coverage/page.tsx` file.
2. Restore the previous navigation behavior.

## Account page rollback

1. Remove `AccountsDeferredLoader` imports from the account page.
2. Restore previous server-side data loading.

## Notes

No database migration is included, so rollback does not require schema changes.
