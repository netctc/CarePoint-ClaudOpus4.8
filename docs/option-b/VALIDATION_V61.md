# Option B V61 Validation

Validation performed for V61:

```bash
python -m compileall -q services/python-worker/carepoint_python_worker
PYTHONPATH=services/python-worker python scripts/option_b/verify_python_worker.py
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=services/python-worker python -m pytest -q services/python-worker/tests/test_worker_contracts.py --disable-warnings
node --check packages/contracts/dist/index.js
node --check services/api/dist/lib/hybrid-python.js
node --check services/api/dist/modules/hybrid-python/hybrid-python.routes.js
unzip -tq CarePoint_option_B_python_progressive_v61.zip
```

Expected worker manifest values:

- worker version: `0.61.0`
- schema version: `2026-05-option-b-v61`
- cumulative contract vectors: `113`
