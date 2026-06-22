# CarePoint Phase 2 UX-V2 — Implementation Notes

## Delivery purpose

UX-V2 implements the layout and navigation refinement layer on top of UX-V1. It keeps the closed V64 technical baseline intact and limits changes to frontend UX surfaces, design-system assets, audit scripts, validation artifacts, and documentation.

## Implemented changes

### Shared design-system layout primitives

Added:

- `packages/design-system/css/carepoint-layout-primitives.css`

Updated:

- `packages/design-system/tokens/carepoint.tokens.json`
- `packages/design-system/css/carepoint-design-tokens.css`
- `packages/design-system/README.md`

New shared primitives include:

- `cp-app-shell`
- `cp-content-area`
- `cp-main-content`
- `cp-sidebar`
- `cp-sidebar-scroll`
- `cp-nav-item`
- `cp-topbar`
- `cp-search-surface`
- `cp-user-context`
- `skip-link`

### Admin shell and navigation

Updated:

- `apps/admin/src/components/layout/portal-shell.tsx`
- `apps/admin/src/components/layout/sidebar-nav.tsx`
- `apps/admin/src/components/layout/topbar.tsx`
- `apps/admin/src/app/globals.css`

Implemented:

- skip-link to `#admin-main-content`;
- stable, focusable admin main landmark;
- labelled sidebar navigation;
- labelled primary admin navigation;
- `aria-current="page"` on active route links;
- topbar banner role;
- topbar search role;
- responsive topbar/sidebar behavior for smaller screens.

### Provider shell and navigation

Updated:

- `apps/provider/components/layout/portal-shell.tsx`
- `apps/provider/components/layout/sidebar-nav.tsx`
- `apps/provider/components/layout/top-header.tsx`
- `apps/provider/app/globals.css`

Implemented:

- skip-link to `#provider-main-content`;
- stable, focusable provider main landmark;
- labelled sidebar navigation;
- labelled primary provider navigation;
- `aria-current="page"` on active route links;
- topbar banner role;
- search role for provider search;
- labelled provider quick-links navigation;
- responsive topbar/sidebar behavior for smaller screens.

### UX automation

Added:

- `scripts/ux/scan-layout-navigation.mjs`
- `validation/ux/ux-v2-layout-navigation-audit.json`

Updated root `package.json`:

```bash
npm run audit:ux
npm run audit:ux:layout
```

## Phase boundary guarantee

UX-V2 does not modify:

- `services/api/src`
- `services/python-worker`
- `packages/contracts/src`
- database migrations
- hybrid Python worker processors
- Option B V64 closure contracts

## Recommended next delivery

`UX-V3 — Forms, tables, empty states, and dashboard component normalization`

Suggested scope:

1. Normalize field groups, labels, hints, and error summaries.
2. Normalize table wrappers, empty states, and loading states.
3. Apply shared card/section hierarchy to dashboard surfaces.
4. Improve high-density Admin and Provider pages identified in UX-V1.
5. Preserve the V64 technical closure boundary.
