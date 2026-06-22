# UX-V5 Implementation Notes

## Added

- `packages/design-system/css/carepoint-workflow-polish.css`
- `scripts/ux/scan-workflow-polish.mjs`
- `validation/ux/ux-v5-workflow-polish-audit.json`

## Updated

- `package.json` now includes `audit:ux:workflow-polish`; aggregate `audit:ux` includes UX-V5.
- `packages/design-system/tokens/carepoint.tokens.json` now identifies version `ux-v5` and adds workflow tokens.
- Admin and Provider global CSS include UX-V5 primitives for direct portal adoption.
- Provider queue, calendar, and prescription creation surfaces now expose workflow class hooks.
- Admin audit logs and reports builder now expose high-density review class hooks.

## Design-system direction

The implementation favors class hooks and shared primitives over invasive component rewrites. This keeps the phase safe while creating a stable foundation for visual QA and future targeted component extraction.
