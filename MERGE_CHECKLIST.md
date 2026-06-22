# Phase 32 Merge Checklist

## Backend

- [ ] Copy `refillOperationalEvents.ts` to `services/api/src/modules/records/`.
- [ ] Add the import in `records.routes.ts`.
- [ ] Replace the route logic using `records.routes.integration.example.ts`.
- [ ] Run `npm run dev --workspace @care-center/api`.
- [ ] Confirm `/api/records/refill-operational-events?limit=12` no longer returns 500.

## Admin frontend

- [ ] Copy `page.tsx` to the Admin app coverage route folder.
- [ ] Confirm whether the Admin app uses `apps/admin/src/app` or `apps/admin/app`.
- [ ] Merge the deferred account loader pattern into the existing accounts page.
- [ ] Preserve existing Phase 29/30/31 account actions.
- [ ] Confirm `/portal/coverage` no longer returns 404.

## Performance

- [ ] Run `scripts/diagnose_admin_latency.ps1` before merge and save the result.
- [ ] Run it again after merge.
- [ ] Investigate any API endpoint still above 10 seconds.
