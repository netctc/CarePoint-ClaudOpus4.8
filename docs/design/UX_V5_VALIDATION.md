# UX-V5 Validation

## Commands

```bash
npm run audit:ux
npm run audit:ux:workflow-polish
node --check scripts/ux/scan-workflow-polish.mjs
python3 -m json.tool packages/design-system/tokens/carepoint.tokens.json
python3 -m json.tool docs/design/UX_PHASE_MANIFEST.json
python3 -m json.tool validation/ux/ux-v5-workflow-polish-audit.json
unzip -tq CarePoint_design_refinement_phase_ux_v5.zip
```

## Expected result

- UX-V1 through UX-V5 audits complete successfully.
- UX-V5 workflow-polish audit reports 100% completion.
- JSON artifacts are valid.
- ZIP integrity test reports no compressed data errors.

## Manual QA focus

- Provider queue scanability with long refill histories.
- Calendar slot editor and day-card density at tablet width.
- Prescription creation flow with policy/compliance preview.
- Audit log filtered evidence review.
- Reports builder delivery panels and KPI density.
