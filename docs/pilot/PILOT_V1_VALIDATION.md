# PILOT-V1 Validation

## Commands

```bash
npm run audit:pilot
npm run audit:pilot:charter
node --check scripts/pilot/scan-pilot-execution-charter.mjs
python3 -m json.tool docs/pilot/PILOT_PHASE_MANIFEST.json
python3 -m json.tool validation/pilot/pilot-v1-execution-charter-audit.json
python3 -m json.tool validation/pilot/pilot-v1-execution-plan.json
```

## Expected result

- PILOT-V1 scanner completes with 100% coverage.
- QA-V7 closure evidence is detected.
- Phase 4 roadmap contains 6 recommended deliveries.
- Pilot governance roles, cohort scope, release gates, and rollback triggers are present.
- Runtime code remains unchanged.
