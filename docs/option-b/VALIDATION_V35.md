# Validation V35

Validated locally from the V34 base after adding V35:

```bash
python -m compileall -q services/python-worker/carepoint_python_worker
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=services/python-worker python -m pytest -q services/python-worker/tests/test_worker_contracts.py --disable-warnings
PYTHONPATH=services/python-worker python scripts/option_b/verify_python_worker.py
unzip -tq CarePoint_option_B_python_progressive_v35.zip
```

External CI/staging still owns TypeScript dependency installation and build certification:

```bash
npm ci
npm run build:contracts
npm run build:api
```
