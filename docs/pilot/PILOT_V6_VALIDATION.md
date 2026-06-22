# PILOT-V6 Validation

## Commands

```bash
npm run audit:pilot
npm run audit:pilot:final-closure
node --check scripts/pilot/scan-final-go-live-closure.mjs
python3 -m json.tool docs/pilot/PILOT_PHASE_MANIFEST.json
python3 -m json.tool validation/pilot/pilot-v6-final-go-live-closure-audit.json
python3 -m json.tool validation/pilot/pilot-v6-final-go-live-execution-certificate.json
```

## Expected result

- PILOT-V6 final closure audit completes at 100 percent.
- Phase manifest status is `closed`.
- All Pilot deliveries are marked `completed`.
- Technical boundary remains unchanged.
- Post-close operations backlog is present and separated.
