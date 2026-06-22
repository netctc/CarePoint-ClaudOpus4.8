# QA-V4 Validation

## Commands used for this delivery

```bash
npm run audit:qa
node --check scripts/qa/scan-master-qa-plan.mjs
node --check scripts/qa/scan-admin-functional-config.mjs
node --check scripts/qa/scan-provider-functional-workflows.mjs
node --check scripts/qa/scan-api-python-e2e.mjs
node --check packages/contracts/dist/index.js
node --check services/api/dist/lib/hybrid-python.js
node --check services/api/dist/modules/hybrid-python/hybrid-python.routes.js
python3 -m json.tool docs/qa/QA_PHASE_MANIFEST.json
python3 -m json.tool validation/qa/qa-v4-api-python-e2e-audit.json
python3 -m json.tool validation/qa/qa-v4-api-python-e2e-test-plan.json
unzip -tq CarePoint_qa_uat_production_readiness_v4.zip
```

## Expected result

- QA-V1 audit remains complete.
- QA-V2 audit remains complete.
- QA-V3 audit remains complete.
- QA-V4 audit completes at 100%.
- Generated JSON reports are valid.
- Syntax checks pass for QA scripts and relevant compiled JS artifacts.
- ZIP integrity test passes.

## Local environment note

Full build and Python worker commands should be executed in the user local environment where dependencies are installed:

```bash
npm install
npm run build:contracts
npm run build:api
PYTHONPATH=services/python-worker python scripts/option_b/verify_python_worker.py
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=services/python-worker python -m pytest -q services/python-worker/tests/test_worker_contracts.py --disable-warnings
```
