# Changelog — PILOT-V1 to PILOT-V2

## Added

- Staging deployment rehearsal package.
- Environment activation checklist.
- Deployment smoke and rollback rehearsal documentation.
- `scripts/pilot/scan-staging-rehearsal-environment.mjs`.
- `npm run audit:pilot:staging-rehearsal`.
- `validation/pilot/pilot-v2-staging-rehearsal-audit.json`.
- `validation/pilot/pilot-v2-staging-environment-activation-plan.json`.

## Updated

- `docs/pilot/PILOT_PHASE_MANIFEST.json` now marks PILOT-V2 as current.
- `npm run audit:pilot` now runs PILOT-V1 and PILOT-V2 audits.

## Not changed

- Backend contracts.
- Python worker runtime implementation.
- Database schema.
- Application runtime code.
- Closed QA, UX, and Option B phase evidence.

## Next

`PILOT-V3 — Controlled pilot launch runbook and day-0/day-1 execution`.
