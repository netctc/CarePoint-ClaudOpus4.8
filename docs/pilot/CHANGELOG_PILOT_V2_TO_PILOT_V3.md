# Changelog — PILOT-V2 to PILOT-V3

## Added

- Controlled pilot launch runbook.
- Day-0/day-1 execution package.
- Communication and support command center documentation.
- Launch gates, pause criteria and rollback triggers.
- `scripts/pilot/scan-controlled-launch-runbook.mjs`.
- `npm run audit:pilot:launch-runbook`.
- `validation/pilot/pilot-v3-controlled-launch-audit.json`.
- `validation/pilot/pilot-v3-day0-day1-execution-runbook.json`.

## Updated

- `docs/pilot/PILOT_PHASE_MANIFEST.json` now marks PILOT-V3 as current and PILOT-V1/PILOT-V2 as completed.
- `npm run audit:pilot` now runs PILOT-V1, PILOT-V2 and PILOT-V3 audits.

## Not changed

- Backend contracts.
- Python worker runtime implementation.
- Database schema.
- Application runtime code.
- Closed QA, UX and Option B phase evidence.

## Next

`PILOT-V4 — Pilot monitoring, support, incident triage, and daily health review`.
