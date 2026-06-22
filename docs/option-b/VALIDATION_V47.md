# Validation V47

Validated locally:

```bash
python -m compileall -q services/python-worker/carepoint_python_worker
PYTHONPATH=services/python-worker python scripts/option_b/verify_python_worker.py
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=services/python-worker python -m pytest -q services/python-worker/tests/test_worker_contracts.py --disable-warnings
unzip -tq CarePoint_option_B_python_progressive_v47.zip
```

CI/staging must still certify TypeScript with real dependencies:

```bash
npm ci
npm run build:contracts
npm run build:api
```
