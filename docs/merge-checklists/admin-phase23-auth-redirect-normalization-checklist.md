# Phase 23 merge checklist - Admin auth redirect normalization

## Files to merge
- `apps/admin/middleware.ts`
- `apps/admin/src/lib/auth/browser-session.ts`
- `apps/admin/src/lib/api-client.ts`
- `apps/admin/src/app/auth/sign-in/sign-in-client.tsx`

## Validation
1. Restart Admin:
   ```powershell
   npm run dev:admin
   ```
2. Open `http://localhost:3001/portal/dashboard` with no valid cookies.
3. Confirm it redirects to one clean URL similar to:
   `http://localhost:3001/auth/sign-in?next=%2Fportal%2Fdashboard`
4. Refresh the sign-in page several times.
5. Confirm the URL does not become nested, for example it must not become:
   `/auth/sign-in?next=/auth/sign-in?next=...`
6. Complete OTP sign-in and confirm the browser returns to `/portal/dashboard`.
7. Test `http://localhost:3001/portal/organizations` and confirm it redirects back to that page after login.

## Notes
This phase does not modify backend authorization. It only stabilizes Admin frontend authentication redirects and prevents public auth calls from triggering self-redirect loops.
