# Fix notes - 2026-04-16 - auth /me HSP helper hotfix

## Issue fixed
Provider sign-in succeeded, but subsequent `GET /api/auth/me` failed with:

- `ReferenceError: buildHspAccessSummary is not defined`

## Root cause
`services/api/src/modules/auth/auth.routes.ts` called `buildHspAccessSummary(...)` when building the authenticated provider response, but the helper was not imported.

## Change applied
Added:

```ts
import { buildHspAccessSummary } from '../../lib/hsp-access';
```

## Affected route
- `GET /api/auth/me`

## Expected result
Provider and HSP-linked sessions should now return `200` for `/api/auth/me` instead of `500` after sign-in.
