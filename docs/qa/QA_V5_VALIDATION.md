# QA-V5 Validation

## Commands

```bash
npm run audit:qa
npm run audit:qa:uat-role-acceptance
node --check scripts/qa/scan-uat-role-acceptance.mjs
python3 -m json.tool docs/qa/QA_PHASE_MANIFEST.json
python3 -m json.tool validation/qa/qa-v5-uat-role-acceptance-audit.json
python3 -m json.tool validation/qa/qa-v5-uat-role-acceptance-package.json
```

## Expected result

- QA-V1 through QA-V5 audits run through `npm run audit:qa`.
- QA-V5 aggregate completion is 100%.
- UAT role package includes Admin, Provider, Operator/Reviewer, and Platform/Technical Owner acceptance packages.
- No runtime contracts, database, backend worker logic, or application code are changed.

## Output files

- `validation/qa/qa-v5-uat-role-acceptance-audit.json`
- `validation/qa/qa-v5-uat-role-acceptance-package.json`
