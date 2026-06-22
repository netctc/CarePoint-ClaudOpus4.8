# Phase 32 QA Checklist

## API crash recovery

- [ ] `refillOperationalEvents.ts` copied into the records module.
- [ ] `records.routes.ts` imports `listRefillOperationalEvents`.
- [ ] `GET /api/records/refill-operational-events?limit=12` returns 200.
- [ ] Empty operational event data returns `{ items: [], count: 0 }`, not 500.

## Admin route recovery

- [ ] `GET /portal/coverage` returns 200.
- [ ] Admin sidebar/nav coverage link opens the recovery page.
- [ ] Page does not make blocking API calls during initial render.

## Latency regression

- [ ] `/portal/accounts` initial HTML returns without waiting 36–50 seconds.
- [ ] Account table can show loading state while client fetch runs.
- [ ] Failed account API calls show a visible degraded/empty state.
- [ ] `/api/admin/users/providers?limit=25` is tested separately from the page.
- [ ] `/api/admin/users/patients?limit=25` is tested separately from the page.
- [ ] `/api/admin/users/organizations?limit=25` is tested separately from the page.

## Packaging

- [ ] No `.env` files are introduced.
- [ ] No destructive migration is introduced.
- [ ] Phase 29/30/31 account workflows still compile.
