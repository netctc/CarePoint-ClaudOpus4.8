# Phase 27 Merge Checklist — Admin Session Stability

Apply these files:

- `apps/admin/src/app/portal/accounts/page.tsx`
- `apps/admin/src/lib/api-client.ts`
- `apps/admin/src/lib/auth/browser-session.ts`
- `apps/admin/middleware.ts`

Then run:

```powershell
npm run dev --workspace @care-center/api
npm run dev:admin
```

Manual validation:

- Clear localhost cookies once.
- Login through Admin OTP.
- Open `http://localhost:3001/portal/accounts`.
- Confirm no stale `Invalid access token` notice remains in the URL.
- Confirm governance panels are not loaded until clicking **Load governance panels**.
- Confirm patient/provider list requests no longer trigger a burst of audit, notification, governance-summary, and data-quality calls by default.
- Confirm an expired session redirects to `/auth/sign-in?next=/portal/accounts` instead of nesting stale error URLs.

Rollback:

- Restore the previous Phase 26 versions of the four modified files.
