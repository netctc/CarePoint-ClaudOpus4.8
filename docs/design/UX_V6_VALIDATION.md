# UX-V6 Validation

## Commands

```bash
npm run audit:ux
npm run audit:ux:final-qa
node --check scripts/ux/scan-design-surfaces.mjs
node --check scripts/ux/scan-layout-navigation.mjs
node --check scripts/ux/scan-components.mjs
node --check scripts/ux/scan-responsive-accessibility.mjs
node --check scripts/ux/scan-workflow-polish.mjs
node --check scripts/ux/scan-final-visual-accessibility-qa.mjs
python3 -m json.tool packages/design-system/tokens/carepoint.tokens.json
python3 -m json.tool docs/design/UX_PHASE_MANIFEST.json
python3 -m json.tool validation/ux/ux-v6-final-visual-accessibility-qa-audit.json
unzip -tq CarePoint_design_refinement_phase_ux_v6.zip
```

## Expected result

- UX-V1 through UX-V6 audit scripts pass.
- Final QA audit reports 100% completion.
- JSON artifacts are valid.
- ZIP integrity check passes.

## Manual signoff checklist

- Browser smoke Admin and Provider at 1440px, 1100px, 900px, 540px, and 390px.
- Keyboard smoke across login, dashboard, queue, calendar, prescriptions, audit logs, and report builder.
- Confirm focus-visible treatment is visible and stable.
- Confirm dense tables remain readable on small screens.
- Confirm no backend, database, Python worker, or API contract files are changed as part of UX-V6.
