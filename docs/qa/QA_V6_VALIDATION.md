# QA-V6 Validation

## Commands validated for the package

```bash
npm run audit:qa
npm run audit:qa:production-readiness
node --check scripts/qa/scan-master-qa-plan.mjs
node --check scripts/qa/scan-admin-functional-config.mjs
node --check scripts/qa/scan-provider-functional-workflows.mjs
node --check scripts/qa/scan-api-python-e2e.mjs
node --check scripts/qa/scan-uat-role-acceptance.mjs
node --check scripts/qa/scan-production-readiness-go-live.mjs
python3 -m json.tool docs/qa/QA_PHASE_MANIFEST.json
python3 -m json.tool validation/qa/qa-v6-production-readiness-audit.json
python3 -m json.tool validation/qa/qa-v6-go-live-checklist.json
unzip -tq CarePoint_qa_uat_production_readiness_v6.zip
```

## Expected result

- QA-V1 through QA-V6 audit scripts run from `npm run audit:qa`.
- QA-V6 production readiness audit reports 100% aggregate completion.
- Go-live checklist is generated as JSON evidence.
- ZIP integrity test passes.
