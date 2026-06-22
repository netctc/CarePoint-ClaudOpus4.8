# Changelog — UX-V2 to UX-V3

## Added

- Component primitives for forms, tables, empty states, and dashboard KPIs.
- `audit:ux:components` command.
- Component-normalization audit report.
- UX-V3 documentation and validation notes.

## Changed

- Design token version advanced to `ux-v3`.
- Admin and Provider global CSS now include UX-V3 component normalization rules.
- Shared Admin and Provider stat cards now expose semantic dashboard classes and accessible labels.
- Provider queue empty states now use the shared `cp-empty-state` treatment.
- `npm run audit:ux` now runs UX-V1, UX-V2, and UX-V3 audits.

## Not changed

- No backend contract changes.
- No Python worker changes.
- No database migrations.
- No reopening of the closed Option B V64 implementation phase.
