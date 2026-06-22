# UX-V4 Validation

## Automated validation

The UX-V4 validation suite checks that responsive and accessibility hardening is present across the design system, Admin globals, Provider globals, tokens, and package scripts.

```bash
npm run audit:ux
node --check scripts/ux/scan-responsive-accessibility.mjs
python3 -m json.tool packages/design-system/tokens/carepoint.tokens.json
python3 -m json.tool docs/design/UX_PHASE_MANIFEST.json
python3 -m json.tool validation/ux/ux-v4-responsive-accessibility-audit.json
unzip -tq CarePoint_design_refinement_phase_ux_v4.zip
```

## Expected result

- UX-V4 responsive/accessibility audit passes.
- Aggregate completion is 100%.
- ZIP integrity check passes.

## Manual validation still required

Automated source checks cannot replace browser QA. Before production release, run manual viewport, keyboard, contrast, forced-colors, reduced-motion, and print checks on representative Admin and Provider pages.
