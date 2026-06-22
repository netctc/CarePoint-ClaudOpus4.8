# Provider Logout Dropdown V10

## Objective
Ensure the Provider web application always offers a clear, standard logout path from the authenticated workspace header.

## Implemented changes
- Converted the provider header user pill into a clickable account-menu trigger.
- Added a dropdown beside the authenticated user name in the top-right header area.
- Added a **Sign out** action inside the dropdown.
- Logout now calls `POST /api/auth/logout` through `providerApi.logout()` when the API is reachable.
- The client always clears provider/browser session cookies through `clearBrowserSession()` even if the API logout request fails.
- After logout, the provider app redirects to `/sign-in` and refreshes the route cache.
- Added accessible menu behavior:
  - `aria-haspopup="menu"`
  - `aria-expanded`
  - `role="menu"`
  - `role="menuitem"`
  - Escape key closes the menu
  - clicking outside closes the menu
- Added English and Arabic labels for account menu, sign out, and signing-out state.

## Files changed
- `apps/provider/components/layout/top-header.tsx`
- `apps/provider/services/api-client.ts`
- `apps/provider/lib/i18n/provider-dictionary.ts`
- `apps/provider/components/shared/provider-icons.tsx`
- `apps/provider/app/globals.css`

## Validation note
Build validation was not executed in this environment because project dependencies are not installed (`next` is unavailable). Static code inspection confirms the logout entrypoint, API client method, session cleanup, redirect, i18n labels, and CSS classes are present.
