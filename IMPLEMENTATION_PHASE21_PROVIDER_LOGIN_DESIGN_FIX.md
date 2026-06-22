# Phase 21 — Provider Web Login Design Fix

## Objective
Fix the Provider web login page visual rendering after Phase 18 alignment. The route itself was working (`/` redirects to `/sign-in` and `/sign-in` returns HTTP 200), so this phase focuses on the sign-in page design layer.

## Root cause addressed
The previous implementation mixed existing Provider auth styles with Admin-inspired classes. In some merge orders this can render the Provider login page with an incorrect layout because the page depends on global CSS class names that may be overridden or missing after subsequent patches.

## Changes
- Replaced the Provider `/sign-in` markup with a self-contained Admin-style layout using isolated Provider-specific classes:
  - `provider-login-shell`
  - `provider-login-card`
  - `provider-login-hero`
  - `provider-login-panel`
  - `provider-login-form`
- Preserved existing Provider authentication behavior:
  - email/password challenge start
  - managed-device confirmation
  - privileged-access acknowledgement
  - OTP verification
  - resend OTP
  - development OTP display when returned by the API
  - enterprise SSO when configured
- Preserved root redirect:
  - `/` → `/sign-in`
- Added stable responsive CSS for desktop, tablet, and mobile.
- Kept Provider logout CSS from Phase 19 in `globals.css`.

## Files included
- `apps/provider/app/page.tsx`
- `apps/provider/app/sign-in/page.tsx`
- `apps/provider/app/sign-in/sign-in-form.tsx`
- `apps/provider/app/globals.css`
- `docs/merge-checklists/provider-phase21-login-design-fix-checklist.md`
- `docs/api-tests/provider-phase21-login-design-fix.http`

## Validation notes
A full Next.js build was not run in this environment because the uploaded workspace does not include `node_modules`. TypeScript syntax parsing was checked with `tsc`; only expected unresolved dependency/module errors were returned because dependencies are not installed in the extracted validation workspace.

## Manual verification
After applying this patch:

```powershell
npm run dev:provider
```

Open:

```text
http://localhost:3000/
http://localhost:3000/sign-in
http://localhost:3000/portal/dashboard
```

Expected result:
- `/` redirects to `/sign-in`.
- `/sign-in` displays the Admin-style two-panel Provider login page.
- `/portal/dashboard` redirects unauthenticated users to `/sign-in?next=/portal/dashboard`.
- After successful OTP verification, the user returns to the requested Provider portal page.
