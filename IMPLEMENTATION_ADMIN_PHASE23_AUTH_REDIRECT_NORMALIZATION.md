# Phase 23 - Admin Auth Redirect Normalization

## Problem observed
The Admin logs showed repeated sign-in requests with nested `next=` values:

```text
/auth/sign-in?next=%2Fauth%2Fsign-in%3Fnext%3D%2Fportal%2Fdashboard
/auth/sign-in?next=%2Fportal%2Fdashboard
```

This indicates that a client-side unauthorized handler was redirecting to the sign-in page while the browser was already on the sign-in page.

## Root cause
The generic Admin API client redirected to `/auth/sign-in` on any `401`. Public auth calls made from the sign-in screen, such as SSO config or challenge endpoints, can return an unauthorized response in some local/dev states. When that happens on `/auth/sign-in`, the redirect helper used the current sign-in URL as the next destination, causing nested `next` parameters.

## Changes
- Added `normalizeAdminNextPath()` to keep `next` local and reject `/auth/sign-in` as a return target.
- Updated `redirectToAdminSignIn()` to avoid self-redirect loops.
- Updated the Admin API client so public `/api/auth/*` calls do not trigger the global unauthorized redirect handler.
- Updated the Admin sign-in page to sanitize incoming `next` values before pushing after OTP verification.
- Updated Admin middleware to check both `cc_admin_access_token` and `cc_access_token`, and preserve clean current-page redirects for `/portal/*` pages.

## No environment changes
No `.env` file is included. No new environment variables are required.
