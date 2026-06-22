# CarePoint Option B - Validation V55

Recommended validation commands:

```bash
python -m compileall -q services/python-worker/carepoint_python_worker
PYTHONPATH=services/python-worker python scripts/option_b/verify_python_worker.py
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 PYTHONPATH=services/python-worker python -m pytest -q services/python-worker/tests/test_worker_contracts.py --disable-warnings
unzip -tq CarePoint_option_B_python_progressive_v55.zip
```

In environments with Node dependencies installed, also run:

```bash
npm run build:api
```
