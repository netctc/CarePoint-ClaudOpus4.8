# Validation V37

Validated locally with:

```bash
python -m compileall -q services/python-worker/carepoint_python_worker
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=services/python-worker python -m pytest -q services/python-worker/tests/test_worker_contracts.py --disable-warnings
PYTHONPATH=services/python-worker python scripts/option_b/verify_python_worker.py
unzip -tq CarePoint_option_B_python_progressive_v37.zip
```

Expected state:

- Worker version: `0.37.0`
- Schema version: `2026-05-option-b-v37`
- Accumulated contract vectors: 69

TypeScript build remains an external CI/staging validation requiring real `node_modules`:

```bash
npm ci
npm run build:contracts
npm run build:api
```
