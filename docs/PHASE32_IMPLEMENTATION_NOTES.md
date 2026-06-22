# Phase 32 Implementation Notes

## 1. Backend runtime crash

The API log shows a `ReferenceError: listRefillOperationalEvents is not defined` inside:

```txt
services/api/src/modules/records/records.routes.ts:1028:17
```

This must be fixed before validating the Safety/Records admin screens because the endpoint returns 500 every time it is called.

### Fix

Copy:

```txt
backend/src/modules/records/refillOperationalEvents.ts
```

into:

```txt
services/api/src/modules/records/refillOperationalEvents.ts
```

Then add this import to `records.routes.ts`:

```ts
import { listRefillOperationalEvents } from './refillOperationalEvents';
```

Adapt the route body using:

```txt
backend/src/modules/records/records.routes.integration.example.ts
```

## 2. `/portal/coverage` 404

The Admin app is repeatedly requesting `/portal/coverage` and receiving 404. Add the included page file to:

```txt
apps/admin/src/app/portal/coverage/page.tsx
```

If your Admin app uses `app/portal/...` without `src`, place it at:

```txt
apps/admin/app/portal/coverage/page.tsx
```

## 3. Slow Admin SSR

The Admin logs show `/portal/accounts` taking 36–50 seconds. That means the page likely performs blocking server-side data fetches or waits for multiple slow API calls before returning HTML.

### Recommended mitigation

- Render the Admin page shell first.
- Load heavy tables from a client component.
- Use request timeout and degraded empty/error states.
- Keep server components only for lightweight layout/auth checks.

Files included:

```txt
frontend/admin/lib/fetchJsonWithTimeout.ts
frontend/admin/components/accounts/AccountsDeferredLoader.tsx
frontend/admin/app/portal/accounts/page.deferred.example.tsx
```

## 4. Admin users API 503

The logs show 503 responses after more than 30 seconds for:

- `/api/admin/users/patients`
- `/api/admin/users/providers`
- `/api/admin/users/organizations?limit=100`

This typically means an expensive Prisma query, connection pool pressure, missing indexes, or too much relation loading.

### Hardening pattern

- Default list limit: 25.
- Maximum list limit: 100.
- Use `select`, not broad `include`.
- Add search indexes later if the query plan confirms table scans.
- Use `Promise.allSettled` for dashboard panels.
- Return degraded partial data instead of blocking the whole page.

See:

```txt
backend/src/modules/admin-users/adminUsersResilience.notes.ts
```

## Verification commands

```powershell
npm run dev --workspace @care-center/api
npm run dev:admin

Invoke-WebRequest http://localhost:4000/api/records/refill-operational-events?limit=12 -UseBasicParsing
Invoke-WebRequest http://localhost:3001/portal/coverage -UseBasicParsing
Invoke-WebRequest http://localhost:3001/portal/accounts -UseBasicParsing
```
