# Phase 19 — Provider Web Logout Button

## Objective
Add a visible and reliable logout control to the Provider Web portal so clinical users can terminate their session without manually clearing cookies or closing the browser.

## Implemented changes

### Provider portal header
- Updated `apps/provider/components/layout/top-header.tsx`.
- Added a visible **Logout** button in the authenticated Provider portal top header.
- The button appears next to the notification/sync controls and before the provider profile pill.
- Added loading/disabled state while logout is in progress.

### Session clearing behavior
- Added `providerApi.logout()` in `apps/provider/services/api-client.ts`.
- The logout action calls `POST /api/auth/logout` so the API can revoke/clear server-side refresh cookies when available.
- The client always calls `clearBrowserSession()` after the logout attempt, even if the API is offline.
- The Provider portal redirects to `/sign-in` and refreshes the Next.js route cache after logout.

### UI and localization
- Added `signOut` and `signingOut` labels in English and Arabic in `provider-dictionary.ts`.
- Added a `signOut` icon to `ProviderIcon`.
- Added `.logout-button` styles in `apps/provider/app/globals.css`.

## Files changed
- `apps/provider/components/layout/top-header.tsx`
- `apps/provider/services/api-client.ts`
- `apps/provider/lib/i18n/provider-dictionary.ts`
- `apps/provider/components/shared/provider-icons.tsx`
- `apps/provider/app/globals.css`

## Manual verification
1. Start API on port `4000`.
2. Start Provider web on port `3000`.
3. Open `/sign-in` and log in as a provider.
4. Confirm that the Provider portal header shows **Logout**.
5. Click **Logout**.
6. Expected result:
   - Browser redirects to `/sign-in`.
   - Provider cookies are cleared.
   - Reopening `/portal/dashboard` redirects back to `/sign-in`.
7. Optional API verification:
   - Check network tab for `POST /api/auth/logout` returning `204`.

## Notes
- No `.env` file is included.
- No new environment variables are required.
- This patch does not change authentication rules or token generation; it only adds a visible logout action and safe session cleanup.
