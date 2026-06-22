# Phase 27 — Admin Session Stability and Account Page Load Control

## Problem addressed

The Admin Accounts page could become unstable after long operations or after an old failed server action left a URL such as:

`/portal/accounts?error=Invalid access token...`

Observed symptoms included:

- redirects back to `/auth/sign-in` after opening `/portal/accounts`
- stale `error=Invalid access token` query parameters being preserved in `next=` URLs
- API calls returning 401 after the access token expired
- account page loading too many governance panels at once and increasing the chance of token expiry or database timeouts

## Changes

### Admin account page

Updated:

- `apps/admin/src/app/portal/accounts/page.tsx`

Changes:

- Adds refresh-token fallback for server-side Admin API requests.
- Converts invalid/expired access token errors into a clean sign-in redirect instead of preserving stale error URLs.
- Stops loading heavy governance panels by default.
- Adds a **Load governance panels** button for audit/governance/data-quality/review-task/notification panels.
- Keeps the default account page focused on patients, providers, organizations, and provider roles.

### Admin browser API client

Updated:

- `apps/admin/src/lib/api-client.ts`

Changes:

- Adds `credentials: 'include'` to API requests so refresh cookies issued by the API are retained and sent.
- Retries protected client requests once after calling `/api/auth/refresh`.
- Keeps Admin/browser mirror cookies synchronized after refresh.

### Admin browser session helpers

Updated:

- `apps/admin/src/lib/auth/browser-session.ts`

Changes:

- Adds stronger cookie persistence for Admin access cookies.
- Adds stronger clearing for Admin/shared access and refresh cookies.

### Admin middleware

Updated:

- `apps/admin/middleware.ts`

Changes:

- Removes transient `error` and `success` query parameters from sign-in `next=` targets.
- Prevents stale action errors from being restored after sign-in.

## Test steps

1. Restart API and Admin.
2. Clear browser cookies for `localhost` once after applying.
3. Sign in again through Admin OTP.
4. Open `/portal/accounts`.
5. Confirm the page loads faster and does not immediately request all governance endpoints.
6. Click **Load governance panels** only when you need the heavier operational panels.
7. Leave the page open until the access token expires and trigger an action; it should either refresh or redirect cleanly to sign-in.

## Environment variables

No `.env` file is included.
No new required environment variables were added.
