# Option B V62 Validation

Recommended validation commands:

```bash
python -m compileall -q services/python-worker/carepoint_python_worker
PYTHONPATH=services/python-worker python scripts/option_b/verify_python_worker.py
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=services/python-worker python -m pytest -q services/python-worker/tests/test_worker_contracts.py --disable-warnings
node --check packages/contracts/dist/index.js
node --check services/api/dist/lib/hybrid-python.js
node --check services/api/dist/modules/hybrid-python/hybrid-python.routes.js
unzip -tq CarePoint_option_B_python_progressive_v62.zip
```

Expected worker result:

- `Option B Python worker v62 verification passed.`
- `187 Python worker contract tests passing.`
- `schemaVersion=2026-05-option-b-v62`
- `vectors=115`
