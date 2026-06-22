# Admin + Provider multilingual implementation

This pass adds multilingual portal support for the web applications with a working English/Arabic switch, persisted locale selection, RTL/LTR handling, and locale propagation to the backend.

## Implemented

### Shared portal behavior
- Added persisted locale selection through `cc_locale` cookie and browser storage.
- Added dynamic `lang` and `dir` handling at the HTML root.
- Added language switcher UI for both portals.
- Added locale header propagation to API requests via `x-locale`.
- Added RTL-aware CSS helpers for the most visible shell/layout regions.

### Admin portal
- Added admin locale provider and translation dictionary.
- Localized:
  - admin sign-in page
  - admin top bar
  - admin sidebar navigation
  - admin dashboard
- Added server-side locale resolution for root layout and dashboard render path.

### Provider portal
- Added provider locale provider and translation dictionary.
- Localized:
  - provider sign-in page
  - provider top header
  - provider sidebar navigation
  - provider dashboard
- Added server-side locale resolution for root layout and sign-in fallback.

## Main files added
- `apps/admin/src/lib/i18n/admin-dictionary.ts`
- `apps/admin/src/components/i18n/admin-locale-provider.tsx`
- `apps/admin/src/components/i18n/admin-language-switcher.tsx`
- `apps/provider/lib/i18n/provider-dictionary.ts`
- `apps/provider/components/i18n/provider-locale-provider.tsx`
- `apps/provider/components/i18n/provider-language-switcher.tsx`

## Main files updated
- `apps/admin/src/app/layout.tsx`
- `apps/admin/src/app/auth/sign-in/page.tsx`
- `apps/admin/src/app/auth/sign-in/sign-in-client.tsx`
- `apps/admin/src/app/portal/dashboard/page.tsx`
- `apps/admin/src/components/layout/sidebar-nav.tsx`
- `apps/admin/src/components/layout/topbar.tsx`
- `apps/admin/src/app/globals.css`
- `apps/admin/src/lib/api-client.ts`
- `apps/provider/app/layout.tsx`
- `apps/provider/app/sign-in/page.tsx`
- `apps/provider/app/sign-in/sign-in-form.tsx`
- `apps/provider/app/portal/dashboard/page.tsx`
- `apps/provider/components/layout/sidebar-nav.tsx`
- `apps/provider/components/layout/top-header.tsx`
- `apps/provider/app/globals.css`
- `apps/provider/services/api-client.ts`
- `apps/provider/lib/auth/browser-session.ts`

## Remaining next step
The multilingual foundation is now active, but not every Admin and Provider route has been translated yet. The next expansion should cover the remaining route pages by replacing literal screen copy with dictionary keys using the same locale providers introduced here.
