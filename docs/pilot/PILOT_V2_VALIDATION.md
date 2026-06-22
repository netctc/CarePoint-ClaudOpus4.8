# PILOT-V2 — Validation

## Commands

```bash
npm run audit:pilot
npm run audit:pilot:staging-rehearsal
node --check scripts/pilot/scan-pilot-execution-charter.mjs
node --check scripts/pilot/scan-staging-rehearsal-environment.mjs
python3 -m json.tool docs/pilot/PILOT_PHASE_MANIFEST.json
python3 -m json.tool validation/pilot/pilot-v2-staging-rehearsal-audit.json
python3 -m json.tool validation/pilot/pilot-v2-staging-environment-activation-plan.json
unzip -tq CarePoint_controlled_pilot_go_live_execution_v2.zip
```

## Expected result

```text
PILOT-V1 execution charter audit written successfully.
PILOT-V2 staging rehearsal/environment activation audit written successfully.
Aggregate completion: 100% (.../...)
No errors detected in compressed data of CarePoint_controlled_pilot_go_live_execution_v2.zip.
```

## Notes

PILOT-V2 is an execution-governance package. It does not change backend contracts, Python worker code, database schema, or application runtime code.
