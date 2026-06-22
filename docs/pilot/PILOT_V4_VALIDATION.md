# PILOT-V4 - Validation

## Commands

```bash
npm run audit:pilot
npm run audit:pilot:monitoring-support
node --check scripts/pilot/scan-pilot-monitoring-support.mjs
python3 -m json.tool docs/pilot/PILOT_PHASE_MANIFEST.json
python3 -m json.tool validation/pilot/pilot-v4-monitoring-support-audit.json
python3 -m json.tool validation/pilot/pilot-v4-daily-health-review-plan.json
```

## Expected result

- PILOT-V1 audit passes.
- PILOT-V2 audit passes.
- PILOT-V3 audit passes.
- PILOT-V4 monitoring/support audit passes.
- Aggregate completion is 100%.
- Daily health review plan is generated.
- No runtime code, database, Python worker or backend contract changes are introduced.
