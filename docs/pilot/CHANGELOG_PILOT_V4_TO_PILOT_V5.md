# Changelog - PILOT-V4 to PILOT-V5

## Added

- Pilot feedback collection model.
- Defect burn-down policy.
- Adoption evidence metrics.
- Expansion decision options.
- Expansion readiness checklist.
- Decision meeting agenda.
- `scripts/pilot/scan-pilot-feedback-expansion.mjs`.
- `validation/pilot/pilot-v5-feedback-expansion-audit.json`.
- `validation/pilot/pilot-v5-feedback-defect-adoption-expansion-plan.json`.

## Updated

- `package.json` now includes `audit:pilot:feedback-expansion`.
- `npm run audit:pilot` now runs PILOT-V1 through PILOT-V5.
- `docs/pilot/PILOT_PHASE_MANIFEST.json` now marks PILOT-V5 as current.

## Not changed

- Backend contracts.
- Python worker.
- Database schema.
- Application runtime code.
