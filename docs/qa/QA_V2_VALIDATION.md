# QA-V2 Validation

## Commands

Run from the repository root:

```bash
npm run audit:qa
node --check scripts/qa/scan-master-qa-plan.mjs
node --check scripts/qa/scan-admin-functional-config.mjs
python3 -m json.tool docs/qa/QA_PHASE_MANIFEST.json
python3 -m json.tool validation/qa/qa-v2-admin-functional-config-audit.json
python3 -m json.tool validation/qa/qa-v2-admin-functional-test-plan.json
```

## Expected result

The QA-V2 audit should report 100 percent aggregate completion.

## Interpretation

A passing QA-V2 audit means Admin functional QA is ready to execute. It does not mean every Admin scenario has been manually executed. Manual execution, screenshots, logs, and stakeholder signoff are collected during later QA/UAT activities.

## Technical boundary

No backend, Python worker, database, or runtime behavior is modified by QA-V2.
