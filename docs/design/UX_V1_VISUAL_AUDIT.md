# CarePoint Phase 2 UX-V1 — Visual and UX Baseline Audit

## Executive summary

UX-V1 starts a new phase after the technical closure of `Option B Python Progressive` at V64. The purpose of this delivery is to create a reliable baseline for design refinement without reopening backend, API, or Python worker implementation scope.

The initial scan found a mature but visually fragmented web surface across Admin and Provider portals. Both portals already include a broad visual language, responsive media queries, and RTL/i18n support, but they need a shared token source, accessibility normalization, and progressive consolidation of repeated patterns.

## Baseline scanned

- Source baseline: `CarePoint_option_B_python_progressive_v64`
- Web roots: `apps/admin`, `apps/provider`
- Scanned files: 185
- TSX files: 141
- Buttons detected: 321
- Inputs detected: 161
- Selects detected: 110
- Tables detected: 31
- Forms detected: 49
- `className` usages detected: 4352
- ARIA references detected: 32

## CSS surface summary

| App | CSS file | Lines | Variables | Class selectors | Media queries | Focus-visible rules | Reduced-motion rules | Hard-coded hex values |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Admin | `apps/admin/src/app/globals.css` | 1805 | 26 | 183 | 6 | 1 | 1 | 58 |
| Provider | `apps/provider/app/globals.css` | 1161 | 23 | 223 | 5 | 1 | 1 | 94 |

## Priority UX surfaces detected

1. `apps/admin/src/app/portal/accounts/page.tsx`
2. `apps/provider/app/portal/queue/page.tsx`
3. `apps/provider/app/portal/calendar/page.tsx`
4. `apps/provider/app/portal/prescriptions/new/page.tsx`
5. `apps/admin/src/app/portal/audit/logs/page.tsx`
6. `apps/admin/src/app/portal/reports/builder/page.tsx`
7. `apps/admin/src/components/admin/booking-admin-actions.tsx`
8. `apps/admin/src/app/portal/organizations/page.tsx`
9. `apps/provider/app/portal/dashboard/page.tsx`
10. `apps/provider/app/portal/encounters/[encounterId]/note/page.tsx`

These surfaces should lead the next UX deliveries because they combine high interaction density, form usage, tables, and/or operational importance.

## Key findings

### 1. Design tokens exist locally but are not governed centrally

Admin and Provider CSS each define strong local variables. UX-V1 adds a canonical token file under `packages/design-system/tokens/carepoint.tokens.json` and CSS variables under `packages/design-system/css/carepoint-design-tokens.css`.

### 2. Interaction density is high

The scan found 321 buttons, 161 inputs, 110 selects, 31 tables, and 49 forms across the web portals. This means design consistency should prioritize buttons, fields, data tables, drawers, status indicators, and page headers.

### 3. Accessibility needs systematic expansion

ARIA coverage is present but thin compared with the number of interactive surfaces. UX-V1 adds shared `:focus-visible`, target-size, reduced-motion, and screen-reader primitives. Later UX deliveries should improve accessible labels, table captions, drawer/modal focus management, and error summaries.

### 4. Responsive support exists but needs product QA

Both portals already contain responsive media queries. The next step is not to add more breakpoints blindly, but to QA real flows on desktop, tablet, and mobile widths.

### 5. Hard-coded colors should be reduced gradually

Hard-coded hex values are still present in both portals. UX-V1 introduces canonical tokens. Future work should migrate values gradually to `--cp-*` tokens after visual comparison.

## UX-V1 actions included

- Added design token JSON source.
- Added CSS custom-property token foundation.
- Added shared UX primitives to Admin and Provider global CSS.
- Added `audit:ux` npm script.
- Added `scripts/ux/scan-design-surfaces.mjs`.
- Generated `validation/ux/ux-v1-design-surface-audit.json`.
- Added phase documentation and delivery plan.

## What UX-V1 intentionally does not do

- It does not change API contracts.
- It does not change the Python worker.
- It does not alter database schemas.
- It does not reopen Option B closure.
- It does not redesign screens wholesale before the visual baseline is accepted.

