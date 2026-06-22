# Validation V42

Run from repository root:

```bash
python -m compileall -q services/python-worker/carepoint_python_worker
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=services/python-worker python -m pytest -q services/python-worker/tests/test_worker_contracts.py --disable-warnings
PYTHONPATH=services/python-worker python scripts/option_b/verify_python_worker.py
unzip -tq CarePoint_option_B_python_progressive_v42.zip
```

External CI/staging validation still needs real TypeScript dependencies:

```bash
npm ci
npm run build:contracts
npm run build:api
```
