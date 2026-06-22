# QA-V3 Validation

## Commands

Run from the repository root:

```bash
npm run audit:qa
npm run audit:qa:provider-workflows
node --check scripts/qa/scan-master-qa-plan.mjs
node --check scripts/qa/scan-admin-functional-config.mjs
node --check scripts/qa/scan-provider-functional-workflows.mjs
python3 -m json.tool docs/qa/QA_PHASE_MANIFEST.json
python3 -m json.tool validation/qa/qa-v3-provider-functional-workflows-audit.json
python3 -m json.tool validation/qa/qa-v3-provider-functional-test-plan.json
```

## Expected result

The QA-V3 audit should report 100 percent aggregate completion.

## Interpretation

A passing QA-V3 audit means Provider functional and clinical workflow QA is ready to execute. It does not mean all Provider scenarios have already been manually performed or signed off.

## Technical boundary

No backend, Python worker, database, or runtime behavior is modified by QA-V3.
