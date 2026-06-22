# Provider Root Login Fix V9

## Change applied
The provider web application root page now redirects directly to the existing login page.

## Why
The previous starter landing page at `/` displayed:
- "Provider Web Application Starter"
- "Open Sign-In"
- "Open Portal"

That starter page should never be shown in the provider web app.

## File updated
- `apps/provider/app/page.tsx`

## New behavior
- Opening `http://localhost:3000/` redirects to `/sign-in`.
- The existing provider login page remains the first visible screen.

## Admin check
- `apps/admin/src/app/page.tsx` already redirects to `/auth/sign-in`, so no admin root change was required.
