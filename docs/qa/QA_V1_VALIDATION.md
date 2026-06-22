# QA-V1 Validation

## Commands

```bash
npm run audit:qa
node --check scripts/qa/scan-master-qa-plan.mjs
python3 -m json.tool docs/qa/QA_PHASE_MANIFEST.json
python3 -m json.tool validation/qa/qa-v1-master-qa-plan-audit.json
python3 -m json.tool validation/qa/qa-v1-critical-e2e-test-matrix.json
unzip -tq CarePoint_qa_uat_production_readiness_v1.zip
```

## Expected result

The QA-V1 audit should report 100 percent completion and generate the master QA plan audit plus the critical E2E test matrix.

## Boundary

QA-V1 is a planning and evidence-setup delivery. It does not execute UAT, does not certify production, and does not modify runtime behavior.
