# Changelog — UX-V1 to UX-V2

## Summary

UX-V2 advances the CarePoint design refinement phase from baseline audit/tokens to concrete layout and navigation improvements across Admin and Provider portals.

## Added

- `packages/design-system/css/carepoint-layout-primitives.css`
- `scripts/ux/scan-layout-navigation.mjs`
- `validation/ux/ux-v2-layout-navigation-audit.json`
- `docs/design/UX_V2_LAYOUT_NAVIGATION.md`
- `docs/design/UX_V2_IMPLEMENTATION.md`
- `docs/design/UX_V2_VALIDATION.md`
- `docs/design/CHANGELOG_UX_V1_TO_UX_V2.md`

## Updated

- `package.json`
- `packages/design-system/README.md`
- `packages/design-system/tokens/carepoint.tokens.json`
- `packages/design-system/css/carepoint-design-tokens.css`
- `apps/admin/src/components/layout/portal-shell.tsx`
- `apps/admin/src/components/layout/sidebar-nav.tsx`
- `apps/admin/src/components/layout/topbar.tsx`
- `apps/admin/src/app/globals.css`
- `apps/provider/components/layout/portal-shell.tsx`
- `apps/provider/components/layout/sidebar-nav.tsx`
- `apps/provider/components/layout/top-header.tsx`
- `apps/provider/app/globals.css`
- `docs/design/UX_PHASE_MANIFEST.json`
- `docs/design/UX_PHASE_ROADMAP.md`

## Changed behavior

- Admin and Provider shells now expose keyboard skip-links to main content.
- Main content areas now have stable ids and are programmatically focusable.
- Sidebar navigation now exposes clearer landmarks.
- Active navigation states now expose `aria-current="page"`.
- Topbars now expose banner/search semantics.
- Admin and Provider layouts now include responsive rules for smaller screens.

## Not changed

UX-V2 does not change:

- backend behavior;
- Python worker behavior;
- API contracts;
- database schema;
- Option B V64 closure status.
