# Validation V45

Recommended validation commands:

```bash
python -m compileall -q services/python-worker/carepoint_python_worker
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=services/python-worker python -m pytest -q services/python-worker/tests/test_worker_contracts.py --disable-warnings
PYTHONPATH=services/python-worker python scripts/option_b/verify_python_worker.py
unzip -tq CarePoint_option_B_python_progressive_v45.zip
```

TypeScript build still requires real dependencies in CI/staging:

```bash
npm ci
npm run build:contracts
npm run build:api
```
