# UX-V3 Implementation Notes

## Added files

- `packages/design-system/css/carepoint-component-primitives.css`
- `scripts/ux/scan-components.mjs`
- `validation/ux/ux-v3-component-normalization-audit.json`
- `docs/design/UX_V3_COMPONENT_NORMALIZATION.md`
- `docs/design/UX_V3_IMPLEMENTATION.md`
- `docs/design/UX_V3_VALIDATION.md`
- `docs/design/CHANGELOG_UX_V2_TO_UX_V3.md`

## Updated files

- `package.json`
- `packages/design-system/README.md`
- `packages/design-system/tokens/carepoint.tokens.json`
- `packages/design-system/css/carepoint-design-tokens.css`
- `apps/admin/src/app/globals.css`
- `apps/provider/app/globals.css`
- `apps/admin/src/components/ui/stat-card.tsx`
- `apps/provider/components/shared/stat-card.tsx`
- `apps/provider/app/portal/queue/page.tsx`
- `docs/design/UX_PHASE_ROADMAP.md`
- `docs/design/UX_PHASE_MANIFEST.json`

## Notes

The implementation is intentionally progressive. Existing component APIs are preserved, while visual normalization is introduced through shared classes and global CSS primitives.
