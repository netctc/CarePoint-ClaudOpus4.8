# QA-V7 Final Evidence Index

## Purpose

This index lists the final QA/UAT evidence artifacts that should be archived before pilot or production go-live.

## Validation reports

| Artifact | Purpose |
|---|---|
| `validation/qa/qa-v1-master-qa-plan-audit.json` | Master QA plan audit |
| `validation/qa/qa-v1-critical-e2e-test-matrix.json` | Critical E2E/UAT matrix |
| `validation/qa/qa-v2-admin-functional-config-audit.json` | Admin functional/config audit |
| `validation/qa/qa-v2-admin-functional-test-plan.json` | Admin functional test plan |
| `validation/qa/qa-v3-provider-functional-workflows-audit.json` | Provider workflow audit |
| `validation/qa/qa-v3-provider-functional-test-plan.json` | Provider clinical workflow test plan |
| `validation/qa/qa-v4-api-python-e2e-audit.json` | Node/API/Python E2E audit |
| `validation/qa/qa-v4-api-python-e2e-test-plan.json` | Node/API/Python E2E test plan |
| `validation/qa/qa-v5-uat-role-acceptance-audit.json` | UAT acceptance audit |
| `validation/qa/qa-v5-uat-role-acceptance-package.json` | UAT role signoff package |
| `validation/qa/qa-v6-production-readiness-audit.json` | Production readiness audit |
| `validation/qa/qa-v6-go-live-checklist.json` | Go-live checklist |
| `validation/qa/qa-v7-final-qa-uat-closure-audit.json` | Final closure audit |
| `validation/qa/qa-v7-final-qa-uat-closure-package.json` | Final closure package |

## Closure documents

| Artifact | Purpose |
|---|---|
| `docs/qa/QA_V7_FINAL_QA_UAT_CLOSURE_CERTIFICATE.md` | Final QA/UAT closure certificate |
| `docs/qa/QA_V7_FINAL_EVIDENCE_INDEX.md` | Evidence index |
| `docs/qa/QA_V7_POST_CLOSE_BACKLOG.md` | Post-close backlog separation |
| `docs/qa/QA_V7_VALIDATION.md` | Validation instructions and results |
| `docs/qa/CHANGELOG_QA_V6_TO_QA_V7.md` | Delivery changelog |

## Required external execution evidence

Before actual production go-live, archive the output of:

```bash
npm install
npm run build:api
npm run build:web
npm run audit:qa
PYTHONPATH=services/python-worker python scripts/option_b/verify_python_worker.py
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=services/python-worker python -m pytest -q services/python-worker/tests/test_worker_contracts.py --disable-warnings
```
