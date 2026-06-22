# Provider Phase 19 Logout Merge Checklist

## Merge order
1. Apply Provider UI files.
2. Apply Provider service client file.
3. Apply Provider dictionary and icon updates.
4. Apply CSS update.

## Verification checklist
- [ ] Provider `/` still redirects to `/sign-in` if Phase 18 is already applied.
- [ ] Provider `/sign-in` still starts the OTP challenge.
- [ ] Provider `/portal/dashboard` shows the new Logout button after login.
- [ ] Logout calls `POST /api/auth/logout` when the API is reachable.
- [ ] Logout clears Provider cookies even when API logout fails.
- [ ] Protected Provider pages redirect to `/sign-in` after logout.
- [ ] English and Arabic labels render correctly.
- [ ] Header remains usable on narrow screens.

## Rollback
Restore the previous versions of:
- `apps/provider/components/layout/top-header.tsx`
- `apps/provider/services/api-client.ts`
- `apps/provider/lib/i18n/provider-dictionary.ts`
- `apps/provider/components/shared/provider-icons.tsx`
- `apps/provider/app/globals.css`
