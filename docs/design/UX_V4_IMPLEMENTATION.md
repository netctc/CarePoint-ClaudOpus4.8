# UX-V4 Implementation

## Scope

UX-V4 extends UX-V3 with responsive, accessibility, and visual QA hardening. It is intentionally non-invasive:

- no backend changes;
- no Python worker changes;
- no database changes;
- no API contract changes.

## Files added

- `packages/design-system/css/carepoint-responsive-a11y.css`
- `scripts/ux/scan-responsive-accessibility.mjs`
- `validation/ux/ux-v4-responsive-accessibility-audit.json`
- `docs/design/UX_V4_RESPONSIVE_ACCESSIBILITY_QA.md`
- `docs/design/UX_V4_IMPLEMENTATION.md`
- `docs/design/UX_V4_VALIDATION.md`
- `docs/design/CHANGELOG_UX_V3_TO_UX_V4.md`

## Files updated

- `package.json`
- `packages/design-system/README.md`
- `packages/design-system/tokens/carepoint.tokens.json`
- `packages/design-system/css/carepoint-design-tokens.css`
- `apps/admin/src/app/globals.css`
- `apps/provider/app/globals.css`
- `docs/design/UX_PHASE_ROADMAP.md`
- `docs/design/UX_PHASE_MANIFEST.json`

## Commands

```bash
npm run audit:ux:responsive-a11y
npm run audit:ux
```
