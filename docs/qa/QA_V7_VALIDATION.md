# QA-V7 Validation

## Commands

```bash
npm run audit:qa
npm run audit:qa:final-closure
node --check scripts/qa/scan-final-qa-uat-closure.mjs
python3 -m json.tool docs/qa/QA_PHASE_MANIFEST.json
python3 -m json.tool validation/qa/qa-v7-final-qa-uat-closure-audit.json
python3 -m json.tool validation/qa/qa-v7-final-qa-uat-closure-package.json
```

## Expected results

- QA-V1 through QA-V7 scanners execute successfully.
- Final closure audit reports 100% completion.
- `docs/qa/QA_PHASE_MANIFEST.json` reports `status: closed` and `delivery: QA-V7`.
- `validation/qa/qa-v7-final-qa-uat-closure-package.json` is generated.

## Production go-live note

QA-V7 closes the QA/UAT evidence phase. Actual go-live still requires environment-specific execution evidence for build, deployment, backup, rollback, monitoring, and role signoff.
