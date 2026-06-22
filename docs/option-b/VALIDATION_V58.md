# CarePoint Option B - Validation V58

Run from repository root:

```bash
python -m compileall -q services/python-worker/carepoint_python_worker
PYTHONPATH=services/python-worker python scripts/option_b/verify_python_worker.py
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=services/python-worker python -m pytest -q services/python-worker/tests/test_worker_contracts.py --disable-warnings
node --check packages/contracts/dist/index.js
unzip -tq CarePoint_option_B_python_progressive_v58.zip
```

Expected worker manifest:

- worker version: `0.58.0`
- schema version: `2026-05-option-b-v58`
- contract vectors: `107`
