# CarePoint Phase 2 UX-V2 — Layout and Navigation Refinement

## Delivery purpose

UX-V2 converts the UX-V1 design foundation into concrete layout and navigation improvements for the Admin and Provider portals. The delivery focuses on shell consistency, sidebar/topbar hierarchy, keyboard navigation affordances, and responsive behavior.

## Scope

Included in UX-V2:

- Admin portal shell landmarks and skip-link.
- Provider portal shell landmarks and skip-link.
- Sidebar navigation labels and active page semantics.
- Topbar/search landmarks.
- Shared layout/navigation tokens.
- Shared CSS layout primitives.
- Tablet/mobile shell refinements.
- Dedicated layout/navigation audit automation.

Excluded from UX-V2:

- backend contract changes;
- Python worker changes;
- database changes;
- new API semantics;
- full table/form redesign, reserved for UX-V3 and UX-V4.

## Admin portal updates

Updated files:

- `apps/admin/src/components/layout/portal-shell.tsx`
- `apps/admin/src/components/layout/sidebar-nav.tsx`
- `apps/admin/src/components/layout/topbar.tsx`
- `apps/admin/src/app/globals.css`

Key improvements:

- stable `admin-main-content` anchor;
- keyboard skip-link to the admin workspace;
- labelled admin sidebar landmark;
- labelled primary admin navigation region;
- `aria-current="page"` active navigation state;
- banner landmark for topbar;
- search landmark for topbar search;
- responsive sidebar/topbar behavior for narrower screens.

## Provider portal updates

Updated files:

- `apps/provider/components/layout/portal-shell.tsx`
- `apps/provider/components/layout/sidebar-nav.tsx`
- `apps/provider/components/layout/top-header.tsx`
- `apps/provider/app/globals.css`

Key improvements:

- stable `provider-main-content` anchor;
- keyboard skip-link to the provider workspace;
- labelled provider sidebar landmark;
- labelled primary provider navigation region;
- `aria-current="page"` active navigation state;
- banner landmark for topbar;
- search landmark for provider search;
- labelled quick-links navigation;
- responsive topbar/link behavior for tablet/mobile.

## Design-system additions

Added:

- `packages/design-system/css/carepoint-layout-primitives.css`

Updated:

- `packages/design-system/tokens/carepoint.tokens.json`
- `packages/design-system/css/carepoint-design-tokens.css`
- `packages/design-system/README.md`

New token groups:

- `layout`
- `navigation`

These define shell width, content max width, topbar height, navigation item height, active indicator width, and responsive content padding.

## Validation summary

UX-V2 adds a dedicated scanner:

```bash
npm run audit:ux:layout
```

The root UX audit now runs both baseline and layout checks:

```bash
npm run audit:ux
```

Generated report:

- `validation/ux/ux-v2-layout-navigation-audit.json`

Audit result:

- Admin layout/navigation checks: 11/11
- Provider layout/navigation checks: 11/11
- Aggregate layout/navigation completion: 22/22
