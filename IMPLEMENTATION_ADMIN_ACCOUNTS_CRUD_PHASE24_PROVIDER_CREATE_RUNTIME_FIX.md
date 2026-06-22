# Phase 24 — Provider Create Runtime Error Fix

## Scope
This phase fixes the Admin runtime overlay that appeared when creating or modifying providers from `/portal/accounts`.

## Problem observed
The Admin page converted any failed API response into a thrown server-action error:

```ts
if (!response.ok) throw new Error(await response.text());
```

When the API returned a JSON error such as `Internal server error`, Next.js displayed the runtime error overlay instead of keeping the user on the page with a readable message.

## Changes included

### Admin web
Updated:

- `apps/admin/src/app/portal/accounts/page.tsx`

Changes:

- Added JSON API error parsing.
- Added readable in-page status notices for success and failure.
- Wrapped patient/provider create, update, delete, and status server actions in safe `try/catch` blocks.
- Redirects failed actions to `/portal/accounts?error=...` instead of throwing a raw runtime exception.
- Redirects successful actions to `/portal/accounts?success=...`.

### Service API
Updated:

- `services/api/src/modules/admin-users/admin-users.routes.ts`

Changes:

- Added defensive handling for Prisma provider create/update failures.
- Converts common provider-creation Prisma errors into readable API responses:
  - duplicate constraint conflict
  - missing linked organization or actor foreign key
  - missing table/column from unapplied migrations
- Makes provider create/update audit logging best-effort so a provider account is not lost because an audit insert fails.
- Validates the onboarding actor ID before writing it to `ProviderOnboardingState`.

## Important operational note
If the in-page error says the account-governance migrations are not fully applied, run:

```powershell
npm run prisma:generate --workspace @care-center/api
npm run prisma:migrate --workspace @care-center/api
```

Then restart API and Admin:

```powershell
npm run dev --workspace @care-center/api
npm run dev:admin
```

## Environment
No `.env` file is included. No new environment variables are required.
