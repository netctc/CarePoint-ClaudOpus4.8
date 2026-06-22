# PILOT-V5 - Validation

Run the following checks from the repository root after applying PILOT-V5:

```bash
npm run audit:pilot
npm run audit:pilot:feedback-expansion
node --check scripts/pilot/scan-pilot-feedback-expansion.mjs
python3 -m json.tool docs/pilot/PILOT_PHASE_MANIFEST.json
python3 -m json.tool validation/pilot/pilot-v5-feedback-expansion-audit.json
python3 -m json.tool validation/pilot/pilot-v5-feedback-defect-adoption-expansion-plan.json
```

Expected result:

- PILOT-V1 through PILOT-V5 audits execute.
- PILOT-V5 aggregate completion is 100 percent.
- The manifest shows PILOT-V5 as current and PILOT-V6 as planned.
- The package is ready for final go-live execution certificate and phase closure.
