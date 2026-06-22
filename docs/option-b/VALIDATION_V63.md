# Option B Python Progressive - Validation V63

Recommended validation commands:

```bash
python -m compileall -q services/python-worker/carepoint_python_worker
PYTHONPATH=services/python-worker python scripts/option_b/verify_python_worker.py
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=services/python-worker python -m pytest -q services/python-worker/tests/test_worker_contracts.py --disable-warnings
node --check packages/contracts/dist/index.js
node --check services/api/dist/lib/hybrid-python.js
node --check services/api/dist/modules/hybrid-python/hybrid-python.routes.js
unzip -tq CarePoint_option_B_python_progressive_v63.zip
```

Expected results:

- Worker verification passes with V63.
- Python worker contract tests pass.
- `schemaVersion=2026-05-option-b-v63`.
- `vectors=117`.
- ZIP integrity check reports no compressed data errors.

`npm run build:api` still requires project `node_modules` in the target environment.
