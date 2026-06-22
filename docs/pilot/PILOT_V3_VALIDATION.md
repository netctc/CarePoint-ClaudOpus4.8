# PILOT-V3 — Validation

## Commands

```bash
npm run audit:pilot
npm run audit:pilot:launch-runbook
node --check scripts/pilot/scan-pilot-execution-charter.mjs
node --check scripts/pilot/scan-staging-rehearsal-environment.mjs
node --check scripts/pilot/scan-controlled-launch-runbook.mjs
python3 -m json.tool docs/pilot/PILOT_PHASE_MANIFEST.json
python3 -m json.tool validation/pilot/pilot-v3-controlled-launch-audit.json
python3 -m json.tool validation/pilot/pilot-v3-day0-day1-execution-runbook.json
unzip -tq CarePoint_controlled_pilot_go_live_execution_v3.zip
```

## Expected result

```text
PILOT-V1 execution charter audit written successfully.
PILOT-V2 staging rehearsal/environment activation audit written successfully.
PILOT-V3 controlled launch runbook audit written successfully.
Aggregate completion: 100% (.../...)
No errors detected in compressed data of CarePoint_controlled_pilot_go_live_execution_v3.zip.
```

## Boundary

PILOT-V3 is a launch execution package. It does not change backend contracts, Python worker implementation, database schema, or application runtime code.
